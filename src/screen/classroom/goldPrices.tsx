import React, { useEffect, useState, CSSProperties } from "react";
import { db } from "../../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc
} from "firebase/firestore";

interface GoldData {
  type: string;
  buy: string;
  sell: string;
}

interface PurchaseData {
  id: string;
  goldType: string;
  quantity: number;
  purchasePrice: number;
  createdAt: any;
  purchaseDate: string;
  userId: string;
}

interface GoldPriceProps {
  user: any;
}

const GoldPriceScreen: React.FC<GoldPriceProps> = ({ user }) => {
  const [goldData, setGoldData] = useState<GoldData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Lắng nghe sự thay đổi kích thước màn hình để cập nhật giao diện
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // States cho form thêm vàng đã mua
  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [selectedGoldType, setSelectedGoldType] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseData[]>([]);

  // Lắng nghe dữ liệu mua vàng từ Firestore
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "goldPurchases"),
      where("userId", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: PurchaseData[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as PurchaseData);
      });
      // Sắp xếp theo thời gian mới nhất
      setPurchases(data.sort((a, b) => {
        const dateA = a.purchaseDate || "";
        const dateB = b.purchaseDate || "";
        
        // Ưu tiên 1: Sắp xếp theo ngày mua (mới nhất lên đầu)
        const dateCompare = dateB.localeCompare(dateA);
        if (dateCompare !== 0) return dateCompare;

        // Ưu tiên 2: Nếu cùng ngày, bản ghi nào tạo sau (createdAt) sẽ lên đầu
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      }
      ));
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const fetchGoldPrices = async () => {
      try {
        setLoading(true);
        const targetUrl = "https://baotinmanhhai.vn/gia-vang-hom-nay";
        const CACHE_KEY = "gold_prices_cache";

        // Danh sách các Proxy để dự phòng khi một cái bị lỗi
        const proxies = [
          { url: `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`, type: 'text' },
          { url: `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`, type: 'text' },
          { url: `https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, type: 'json' },
          { url: `https://api.codetabs.com/v1/proxy?url=${encodeURIComponent(targetUrl)}`, type: 'text' },
          { url: `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(targetUrl)}`, type: 'text' },
          { url: `https://yacdn.org/proxy/${encodeURIComponent(targetUrl)}`, type: 'text' },
          { url: `https://api.proxyscrape.com/v2/?request=getcontent&protocol=http&url=${encodeURIComponent(targetUrl)}`, type: 'text' }
        ];

        let html = "";
        let lastErr = "";

        for (const proxy of proxies) {
          try {
            const response = await fetch(proxy.url);
            if (!response.ok) continue;

            if (proxy.type === 'json') {
              const data = await response.json();
              html = data.contents;
            } else {
              html = await response.text();
            }

            if (html && html.includes("table")) break; // Nếu lấy được HTML hợp lệ thì dừng vòng lặp
          } catch (e: any) {
            lastErr = e.message;
            console.warn(`Proxy ${proxy.url} thất bại, đang thử cái tiếp theo...`);
          }
        }

        // Nếu không tải được qua Proxy, thử tìm trong Cache LocalStorage
        if (!html) {
          const cachedData = localStorage.getItem(CACHE_KEY);
          if (cachedData) {
            const { data, lastSuccessUpdate } = JSON.parse(cachedData);
            setGoldData(data);
            setLastUpdated(`${lastSuccessUpdate} (Dữ liệu cũ)`);
            setLoading(false);
            console.warn("Sử dụng dữ liệu từ bộ nhớ tạm do lỗi kết nối proxy.");
            return;
          }
          throw new Error(lastErr || "Không thể tải dữ liệu. Vui lòng kiểm tra kết nối mạng.");
        }

        // Parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        
        // Thử nhiều selector khác nhau đề phòng website đổi cấu trúc hoặc proxy trả về HTML khác
        const table = doc.querySelector(".gold-table-content") || 
                      doc.querySelector("table.table") || 
                      doc.querySelector(".table-price");

        if (!table) {
          // Kiểm tra xem có phải bị Cloudflare chặn không thông qua text content
          if (html.includes("Cloudflare")) throw new Error("Proxy bị Cloudflare chặn.");
          throw new Error("Không tìm thấy bảng giá vàng trên trang nguồn.");
        }

        const rows = table.querySelectorAll("tbody tr");
        const parsed = Array.from(rows).map((row) => {
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) return null;
          return {
            type: cells[0]?.textContent?.trim() || "",
            buy: cells[1]?.textContent?.trim() || "—",
            sell: cells[2]?.textContent?.trim() || "—",
          };
        }).filter((item): item is GoldData => item !== null && item.type !== "");

        if (parsed.length === 0) throw new Error("Không thể đọc được dữ liệu bảng giá.");

        setGoldData(parsed);
        const now = new Date().toLocaleTimeString("vi-VN");
        setLastUpdated(now);
        
        // Lưu vào Cache để dùng cho lần sau nếu lỗi
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: parsed,
          lastSuccessUpdate: now
        }));
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchGoldPrices();
  }, []);

  // Tự động chọn loại vàng đầu tiên khi dữ liệu tải xong
  useEffect(() => {
    if (goldData.length > 0 && !selectedGoldType) {
      setSelectedGoldType(goldData[0].type);
    }
  }, [goldData, selectedGoldType]);

  const parsePrice = (priceStr: string) => {
    if (!priceStr || priceStr === "—") return 0;
    return parseInt(priceStr.replace(/\./g, ""));
  };

  const formatCurrencyInput = (value: string) => {
    const number = value.replace(/[^0-9]/g, "");
    return number.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const handleDeletePurchase = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa giao dịch này?")) return;
    try {
      await deleteDoc(doc(db, "goldPurchases", id));
    } catch (err) {
      console.error("Lỗi khi xóa:", err);
      alert("Không thể xóa giao dịch.");
    }
  };

  const handleSavePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !selectedGoldType || !purchaseQuantity || !purchasePrice || !purchaseDate) {
      alert("Vui lòng nhập đầy đủ thông tin!");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "goldPurchases"), {
        userId: user.uid,
        goldType: selectedGoldType,
        quantity: parseFloat(purchaseQuantity),
        purchasePrice: parseInt(purchasePrice.replace(/\./g, "")),
        purchaseDate: purchaseDate,
        createdAt: serverTimestamp(),
      });
      alert("✅ Đã lưu thông tin mua vàng thành công!");
      setPurchaseQuantity("");
      setPurchasePrice("");
    } catch (err) {
      console.error("Lỗi khi lưu:", err);
      alert("❌ Không thể lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  };

  // Tính toán lãi lỗ
  const calculateSummary = () => {
    let totalInvestment = 0;
    let currentValue = 0;

    const detailedPurchases = purchases.map(p => {
      const currentGoldInfo = goldData.find(g => g.type === p.goldType);
      const currentBuyPrice = parsePrice(currentGoldInfo?.buy || "0");
      const investment = p.quantity * p.purchasePrice;
      const currentVal = p.quantity * currentBuyPrice;
      const profit = currentVal - investment;

      totalInvestment += investment;
      currentValue += currentVal;

      return { ...p, currentBuyPrice, profit, investment };
    });

    const totalProfit = currentValue - totalInvestment;
    return { totalInvestment, currentValue, totalProfit, detailedPurchases };
  };

  const styles = {
    container: {
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #0f172a, #1e293b)",
      fontFamily: "Inter, system-ui, sans-serif",
      padding: "24px 16px",
      color: "#f8fafc",
    } as CSSProperties,
    header: {
      textAlign: "center",
      marginBottom: "32px",
    } as CSSProperties,
    logo: {
      display: "inline-flex",
      alignItems: "center",
      gap: "10px",
      marginBottom: "4px",
    } as CSSProperties,
    logoIcon: {
      width: "40px",
      height: "40px",
      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
      borderRadius: "50%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "20px",
      boxShadow: "0 0 20px rgba(245,158,11,0.3)",
    } as CSSProperties,
    title: {
      fontSize: "26px",
      fontWeight: "bold",
      background: "linear-gradient(to right, #fbbf24, #fcd34d, #f59e0b)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      letterSpacing: "1px",
      margin: 0,
    } as CSSProperties,
    subtitle: {
      fontSize: "11px",
      color: "#94a3b8",
      letterSpacing: "3px",
      textTransform: "uppercase",
      marginTop: "4px",
      fontWeight: "600",
    } as CSSProperties,
    source: {
      fontSize: "11px",
      color: "#64748b",
      marginTop: "6px",
    } as CSSProperties,
    divider: {
      width: "80px",
      height: "2px",
      background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.3), transparent)",
      margin: "12px auto",
    } as CSSProperties,
    card: {
      background: "rgba(30,41,59,0.7)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "12px",
      overflow: "hidden",
      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.3)",
      backdropFilter: "blur(4px)",
    } as CSSProperties,
    tableHeader: {
      display: "grid",
      gridTemplateColumns: "1fr 120px 120px",
      background: "rgba(15,23,42,0.5)",
      borderBottom: "1px solid rgba(255,255,255,0.1)",
      padding: "12px 16px",
      gap: "8px",
    } as CSSProperties,
    tableHeaderCell: {
      fontSize: "10px",
      fontWeight: "bold",
      letterSpacing: "2px",
      textTransform: "uppercase",
      color: "#94a3b8",
    } as CSSProperties,
    tableHeaderCellRight: {
      textAlign: "right",
      fontSize: "10px",
      fontWeight: "bold",
      letterSpacing: "2px",
      textTransform: "uppercase",
      color: "#94a3b8",
    } as CSSProperties,
    rowName: {
      fontSize: "13px",
      color: "#f1f5f9",
      lineHeight: "1.4",
      fontWeight: "500",
    } as CSSProperties,
    buyPrice: {
      textAlign: "right",
      fontSize: "13px",
      fontWeight: "600",
      color: "#4ade80",
      fontVariantNumeric: "tabular-nums",
    } as CSSProperties,
    sellPrice: {
      textAlign: "right",
      fontSize: "13px",
      fontWeight: "600",
      color: "#f87171",
      fontVariantNumeric: "tabular-nums",
    } as CSSProperties,
    emptyPrice: {
      textAlign: "right",
      fontSize: "13px",
      color: "#475569",
    } as CSSProperties,
    footer: {
      textAlign: "center",
      marginTop: "16px",
      fontSize: "11px",
      color: "#64748b",
    } as CSSProperties,
    legend: {
      display: "flex",
      justifyContent: "center",
      gap: "24px",
      marginTop: "12px",
      fontSize: "11px",
    } as CSSProperties,
    loadingWrap: {
      textAlign: "center",
      padding: "80px 0",
      color: "#94a3b8",
    } as CSSProperties,
    spinner: {
      width: "36px",
      height: "36px",
      border: "3px solid rgba(212,160,23,0.2)",
      borderTop: "3px solid #fbbf24",
      borderRadius: "50%",
      animation: "spin 1s linear infinite",
      margin: "0 auto 16px",
    } as CSSProperties,
    errorWrap: {
      textAlign: "center",
      padding: "40px 20px",
      color: "#f87171",
    } as CSSProperties,
    formCard: {
      background: "rgba(30,41,59,0.5)",
      border: "1px solid rgba(251,191,36,0.2)",
      borderRadius: "12px",
      padding: "20px",
      marginBottom: "24px",
    } as CSSProperties,
    inputGroup: {
      marginBottom: "12px",
    } as CSSProperties,
    inputLabel: {
      display: "block",
      fontSize: "12px",
      color: "#94a3b8",
      marginBottom: "6px",
      fontWeight: "500",
    } as CSSProperties,
    input: {
      width: "100%",
      background: "rgba(15,23,42,0.6)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: "8px",
      padding: "10px 12px",
      color: "#fff",
      fontSize: "14px",
      outline: "none",
    } as CSSProperties,
    button: {
      width: "100%",
      background: "linear-gradient(to right, #fbbf24, #f59e0b)",
      color: "#1e293b",
      border: "none",
      borderRadius: "8px",
      padding: "12px",
      fontWeight: "bold",
      fontSize: "14px",
      cursor: "pointer",
      marginTop: "8px",
      transition: "opacity 0.2s",
    } as CSSProperties,
    summaryCard: {
      background: "linear-gradient(145deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9))",
      borderRadius: "16px",
      padding: "20px",
      marginBottom: "24px",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 10px 25px -5px rgba(0,0,0,0.5)",
    } as CSSProperties,
    badge: (isProfit: boolean): CSSProperties => ({
      padding: "4px 8px",
      borderRadius: "6px",
      fontSize: "12px",
      fontWeight: "bold",
      background: isProfit ? "rgba(74,222,128,0.2)" : "rgba(248,113,113,0.2)",
      color: isProfit ? "#4ade80" : "#f87171",
    }),
  };

  // Style functions separated to maintain Type Safety
  const getRowStyle = (index: number): CSSProperties => ({
    display: "grid",
    gridTemplateColumns: "1fr 120px 120px",
    padding: "13px 16px",
    gap: "8px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    background: index % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
    alignItems: "center",
    transition: "all 0.2s",
  });

  const getLegendItemStyle = (): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: "5px",
    color: "#94a3b8",
  });

  const getLegendDotStyle = (color: string): CSSProperties => ({
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: color,
  });

  return (
    <div style={styles.container}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .gold-row:hover { background: rgba(255,255,255,0.05) !important; transform: translateX(2px); }
      `}</style>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>💰</div>
          <h1 style={styles.title}>Bảng Giá Vàng</h1>
        </div>
        <p style={styles.subtitle}>Thị trường trực tuyến</p>
        <p style={styles.source}>🛡️ Dữ liệu tin cậy từ Bảo Tín Mạnh Hải</p>
        <div style={styles.divider} />
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Table */}
        {loading ? (
          <div style={styles.loadingWrap}>
            <div style={styles.spinner} />
            <p>Đang tải giá vàng...</p>
          </div>
        ) : error ? (
          <div style={styles.errorWrap}>
            <p style={{ fontSize: "24px", marginBottom: "8px" }}>⚠️</p>
            <p style={{ fontWeight: "bold" }}>Lỗi tải dữ liệu</p>
            <p style={{ fontSize: "12px", marginTop: "6px", color: "#9a7050" }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Thống kê lãi lỗ */}
            {purchases.length > 0 && (
              <div style={styles.summaryCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>📊 Tài Sản Của Tôi</h3>
                  <div style={styles.badge(calculateSummary().totalProfit >= 0)}>
                    {calculateSummary().totalProfit >= 0 ? "📈 Lãi" : "📉 Lỗ"}: {Math.abs(calculateSummary().totalProfit).toLocaleString('vi-VN')}₫
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>TỔNG VỐN ĐẦU TƯ</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold' }}>{calculateSummary().totalInvestment.toLocaleString('vi-VN')}₫</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>GIÁ TRỊ HIỆN TẠI</div>
                    <div style={{ fontSize: 18, fontWeight: 'bold', color: '#fbbf24' }}>{calculateSummary().currentValue.toLocaleString('vi-VN')}₫</div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: '600', marginBottom: 12, color: '#94a3b8' }}>DANH MỤC CHI TIẾT</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {calculateSummary().detailedPurchases.map((p, idx) => (
                      <div key={p.id} style={{
                        background: 'rgba(255,255,255,0.03)',
                        padding: '12px',
                        borderRadius: 10,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span style={{ fontSize: 14, fontWeight: 'bold', color: '#f1f5f9' }}>{p.goldType}</span>
                            <span style={{ fontSize: 10, background: 'rgba(251,191,36,0.1)', color: '#fbbf24', padding: '2px 6px', borderRadius: 4, fontWeight: '600' }}>
                              {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString('vi-VN') : 'N/A'}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: '#94a3b8' }}>
                            <span style={{ color: '#e2e8f0', fontWeight: '600' }}>{p.quantity} chỉ</span> × {p.purchasePrice.toLocaleString('vi-VN')}
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                            Vốn: {p.investment.toLocaleString('vi-VN')}₫
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: 12, marginLeft: 12 }}>
                          <div>
                            <div style={{
                              fontSize: 13,
                              fontWeight: 'bold',
                              color: p.profit >= 0 ? '#4ade80' : '#f87171'
                            }}>
                              {p.profit >= 0 ? '+' : ''}{p.profit.toLocaleString('vi-VN')}₫
                            </div>
                            <div style={{ fontSize: 10, color: '#64748b' }}>Hiện tại: {p.currentBuyPrice.toLocaleString('vi-VN')}</div>
                          </div>
                          <button
                            onClick={() => handleDeletePurchase(p.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#ef4444',
                              cursor: 'pointer',
                              padding: '4px',
                              fontSize: 16
                            }}
                            title="Xóa giao dịch"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div style={{
              display: 'grid',
            gridTemplateColumns: windowWidth >= 1024 ? '1fr 1fr' : '1fr',
              gap: 24,
              alignItems: 'start'
            }}>
              {/* Form thêm giao dịch */}
              <div style={styles.formCard}>
                <h3 style={{ fontSize: "16px", fontWeight: "bold", marginBottom: "16px", color: "#fbbf24" }}>
                  ➕ Thêm Vàng Đã Mua
                </h3>
                <form onSubmit={handleSavePurchase}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Loại vàng</label>
                      <select
                        style={styles.input}
                        value={selectedGoldType}
                        onChange={(e) => setSelectedGoldType(e.target.value)}
                      >
                        {goldData.map((item, idx) => (
                          <option key={idx} value={item.type} style={{ background: "#1e293b" }}>
                            {item.type}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Ngày mua</label>
                      <input
                        style={styles.input}
                        type="date"
                        value={purchaseDate}
                        onChange={(e) => setPurchaseDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Số chỉ</label>
                      <input
                        style={styles.input}
                        type="number"
                        step="0.01"
                        placeholder="0.0"
                        value={purchaseQuantity}
                        onChange={(e) => setPurchaseQuantity(e.target.value)}
                      />
                    </div>
                    <div style={styles.inputGroup}>
                      <label style={styles.inputLabel}>Giá mua (VNĐ/chỉ)</label>
                      <input
                        style={styles.input}
                        type="text"
                        placeholder="Giá thời điểm mua"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(formatCurrencyInput(e.target.value))}
                      />
                    </div>
                  </div>
                  <button type="submit" style={styles.button} disabled={saving}>
                    {saving ? "Đang lưu..." : "Lưu Giao Dịch"}
                  </button>
                </form>
              </div>

              {/* Bảng giá */}
              <div style={styles.card}>
                {/* Table Head */}
                <div style={styles.tableHeader}>
                  <span style={styles.tableHeaderCell}>Loại Vàng</span>
                  <span style={styles.tableHeaderCellRight}>Mua Vào</span>
                  <span style={styles.tableHeaderCellRight}>Bán Ra</span>
                </div>

                {/* Rows */}
                {goldData.map((item, i) => (
                  <div key={i} className="gold-row" style={getRowStyle(i)}>
                    <span style={styles.rowName}>{item.type}</span>
                    <span style={item.buy !== "—" ? styles.buyPrice : styles.emptyPrice}>
                      {item.buy}
                    </span>
                    <span style={item.sell !== "—" ? styles.sellPrice : styles.emptyPrice}>
                      {item.sell}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Legend + footer */}
      {!loading && !error && (
        <>
          <div style={styles.legend}>
            <div style={getLegendItemStyle()} title="Giá tiệm mua lại của bạn">
              <div style={getLegendDotStyle("#4ade80")} />
              <span>Giá mua vào</span>
            </div>
            <div style={getLegendItemStyle()} title="Giá tiệm bán ra cho bạn">
              <div style={getLegendDotStyle("#f87171")} />
              <span>Giá bán ra</span>
            </div>
          </div>
          <div style={styles.footer}>
            {lastUpdated && <p>🕒 Cập nhật lúc: {lastUpdated}</p>}
            <p style={{ marginTop: "4px" }}>Đơn vị: VNĐ / chỉ</p>
          </div>
        </>
      )}
    </div>
  );
};

export default GoldPriceScreen;