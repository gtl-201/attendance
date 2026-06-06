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
  doc,
  updateDoc,
} from "firebase/firestore";

interface PurchaseData {
  id: string;
  goldType: string;
  quantity: number;
  purchasePrice: number;
  createdAt: any;
  purchaseDate: string;
  userId: string;
  sold?: boolean;
  sellPrice?: number;
  sellDate?: string;
}

interface GoldPriceProps {
  user: any;
}

const FIXED_GOLD_TYPES = [
  "Nhẫn Tròn ép vỉ (Kim Gia Bảo) 24K (999.9)",
  "Đồng vàng Kim Gia Bảo hoa sen",
  "Vàng Tiểu Kim Cát 24K (999.9) 0,1 chỉ",
  "Nhẫn tròn 999.9 BTMH",
  "Vàng trang sức 24K (999.9)",
  "Vàng trang sức 24K (99.9)",
  "Vàng miếng SJC (Cty CP BTMH)",
  "Vàng nguyên liệu 999,9",
  "Vàng nguyên liệu 99.9",
];

const GoldPriceScreen: React.FC<GoldPriceProps> = ({ user }) => {
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const [purchaseQuantity, setPurchaseQuantity] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [selectedGoldType, setSelectedGoldType] = useState(FIXED_GOLD_TYPES[0]);
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const [purchases, setPurchases] = useState<PurchaseData[]>([]);
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, "goldPurchases"), where("userId", "==", user.uid));
    return onSnapshot(q, (snap) => {
      const data: PurchaseData[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseData));
      setPurchases(
        data.sort((a, b) => {
          const dc = (b.purchaseDate || "").localeCompare(a.purchaseDate || "");
          return dc !== 0 ? dc : (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        })
      );
    });
  }, [user?.uid]);

  const [currentPrices, setCurrentPrices] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"holding" | "sold">("holding");

  const parsePrice = (str: string) => parseInt((str || "0").replace(/\./g, "").replace(/,/g, "") || "0") || 0;
  const formatCurrency = (v: string) => v.replace(/[^0-9]/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  const handleDelete = async (id: string) => {
    if (!window.confirm("Xóa giao dịch này?")) return;
    try { await deleteDoc(doc(db, "goldPurchases", id)); } catch { alert("Không thể xóa."); }
  };

  const handleSell = async (p: PurchaseData) => {
    const sellPrice = parsePrice(currentPrices[p.goldType] || "");
    if (!sellPrice) return;
    if (!window.confirm(`Xác nhận bán ${p.quantity} chỉ "${p.goldType}" với giá ${sellPrice.toLocaleString("vi-VN")}₫/chỉ?`)) return;
    try {
      await updateDoc(doc(db, "goldPurchases", p.id), {
        sold: true,
        sellPrice,
        sellDate: new Date().toISOString().split("T")[0],
      });
    } catch { alert("❌ Không thể cập nhật."); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid || !selectedGoldType || !purchaseQuantity || !purchasePrice || !purchaseDate) {
      alert("Vui lòng nhập đầy đủ thông tin!"); return;
    }
    setSaving(true);
    try {
      await addDoc(collection(db, "goldPurchases"), {
        userId: user.uid,
        goldType: selectedGoldType,
        quantity: parseFloat(purchaseQuantity),
        purchasePrice: parsePrice(purchasePrice),
        purchaseDate,
        createdAt: serverTimestamp(),
        sold: false,
      });
      setPurchaseQuantity(""); setPurchasePrice("");
    } catch { alert("❌ Không thể lưu dữ liệu."); }
    finally { setSaving(false); }
  };

  const holdingPurchases = purchases.filter((p) => !p.sold);
  const soldPurchases = purchases.filter((p) => p.sold);
  const uniqueTypes = Array.from(new Set(holdingPurchases.map((p) => p.goldType)));

  const summary = (() => {
    let totalInvestment = 0, currentValue = 0;
    let allEntered = uniqueTypes.length > 0;
    const rows = holdingPurchases.map((p) => {
      const curPrice = parsePrice(currentPrices[p.goldType] || "");
      const investment = p.quantity * p.purchasePrice;
      const curVal = curPrice > 0 ? p.quantity * curPrice : 0;
      const profit = curPrice > 0 ? curVal - investment : null;
      totalInvestment += investment;
      if (curPrice > 0) currentValue += curVal; else allEntered = false;
      return { ...p, curPrice, investment, curVal, profit };
    });
    return { rows, totalInvestment, currentValue, totalProfit: currentValue - totalInvestment, allEntered };
  })();

  const soldSummary = (() => {
    let totalInvestment = 0, totalRevenue = 0;
    const rows = soldPurchases.map((p) => {
      const investment = p.quantity * p.purchasePrice;
      const revenue = p.quantity * (p.sellPrice || 0);
      const profit = revenue - investment;
      totalInvestment += investment;
      totalRevenue += revenue;
      return { ...p, investment, revenue, profit };
    });
    return { rows, totalInvestment, totalRevenue, totalProfit: totalRevenue - totalInvestment };
  })();

  const s: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      background: "linear-gradient(160deg, #0f172a 0%, #1a2744 50%, #1e293b 100%)",
      fontFamily: "'Inter', system-ui, sans-serif",
      padding: "24px 16px 40px",
      color: "#f8fafc",
    },
    maxW: { maxWidth: 860, margin: "0 auto" },
    header: { textAlign: "center", marginBottom: 32 },
    titleRow: { display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 2 },
    coin: {
      width: 42, height: 42,
      background: "linear-gradient(135deg, #fbbf24, #f59e0b)",
      borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 22, boxShadow: "0 0 24px rgba(245,158,11,0.35)",
    },
    h1: {
      fontSize: 26, fontWeight: "bold", margin: 0,
      background: "linear-gradient(90deg, #fbbf24, #fde68a, #f59e0b)",
      WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
    },
    sub: { fontSize: 11, color: "#94a3b8", letterSpacing: "3px", textTransform: "uppercase", marginTop: 4, fontWeight: 600 },
    divider: {
      width: 80, height: 2,
      background: "linear-gradient(90deg, transparent, rgba(251,191,36,0.4), transparent)",
      margin: "10px auto 0",
    },
    card: {
      background: "rgba(30,41,59,0.7)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, overflow: "hidden", marginBottom: 28,
      boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
    },
    cardHead: {
      padding: "13px 18px", borderBottom: "1px solid rgba(255,255,255,0.06)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
    },
    tableHead: {
      background: "rgba(15,23,42,0.6)", borderBottom: "1px solid rgba(255,255,255,0.08)",
      padding: "10px 18px", display: "grid",
      gridTemplateColumns: "1fr 175px", gap: 8,
    },
    thCell: { fontSize: 10, fontWeight: "bold", letterSpacing: "2px", textTransform: "uppercase", color: "#64748b" },
    thCellR: { fontSize: 10, fontWeight: "bold", letterSpacing: "2px", textTransform: "uppercase", color: "#64748b", textAlign: "right" },
    formCard: {
      background: "rgba(30,41,59,0.5)", border: "1px solid rgba(251,191,36,0.18)",
      borderRadius: 14, padding: "20px 20px 16px", marginBottom: 28,
    },
    label: { display: "block", fontSize: 11, color: "#94a3b8", fontWeight: 600, marginBottom: 5 },
    input: {
      width: "100%", background: "rgba(15,23,42,0.6)", border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 8, padding: "10px 12px", color: "#fff", fontSize: 14,
      outline: "none", boxSizing: "border-box",
    },
    btn: {
      width: "100%", background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
      color: "#1e293b", border: "none", borderRadius: 8, padding: "12px",
      fontWeight: "bold", fontSize: 14, cursor: "pointer", marginTop: 10,
    },
    portfolioCard: {
      background: "linear-gradient(145deg, rgba(30,41,59,0.95), rgba(15,23,42,0.95))",
      border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: 20,
      marginBottom: 28, boxShadow: "0 12px 30px rgba(0,0,0,0.4)",
    },
  };

  const rowStyle = (i: number): CSSProperties => ({
    display: "grid", gridTemplateColumns: "1fr 175px",
    padding: "11px 18px", gap: 8, alignItems: "center",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)",
    transition: "background 0.15s",
  });

  const badgeStyle = (profit: number): CSSProperties => ({
    padding: "3px 10px", borderRadius: 6, fontSize: 12, fontWeight: "bold",
    background: profit >= 0 ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)",
    color: profit >= 0 ? "#4ade80" : "#f87171",
  });

  return (
    <div style={s.page}>
      <style>{`
        .grow-row:hover { background: rgba(255,255,255,0.04) !important; }
        .gold-input:focus { border-color: rgba(74,222,128,0.5) !important; box-shadow: 0 0 0 2px rgba(74,222,128,0.1); outline: none; }
        .sell-btn { transition: all 0.15s; }
        .sell-btn:not(:disabled):hover { background: rgba(74,222,128,0.25) !important; border-color: rgba(74,222,128,0.6) !important; }
        .tab-btn { transition: all 0.2s; }
      `}</style>

      {/* Header */}
      <div style={s.header}>
        <div style={s.titleRow}>
          <div style={s.coin}>💰</div>
          <h1 style={s.h1}>Quản Lý Vàng</h1>
        </div>
        <p style={s.sub}>Bảo Tín Mạnh Hải</p>
        <div style={s.divider} />
      </div>

      <div style={s.maxW}>

        {/* Bảng giá hiện tại — chỉ loại đang giữ */}
        {uniqueTypes.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <span style={{ fontSize: 14, fontWeight: "bold", color: "#fbbf24" }}>📋 Giá Mua Vào Hiện Tại</span>
              <span style={{ fontSize: 11, color: "#64748b" }}>Nhập để tính lãi / lỗ & bán</span>
            </div>
            <div style={s.tableHead}>
              <span style={s.thCell}>Loại Vàng</span>
              <span style={s.thCellR}>Giá Mua Vào (₫/chỉ)</span>
            </div>
            {uniqueTypes.map((type, i) => (
              <div key={type} className="grow-row" style={rowStyle(i)}>
                <span style={{ fontSize: 13, color: "#e2e8f0", lineHeight: 1.5 }}>{type}</span>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <input
                    className="gold-input"
                    style={{
                      width: 155, fontSize: 13, padding: "7px 10px",
                      textAlign: "right", color: "#4ade80",
                      border: "1px solid rgba(74,222,128,0.22)",
                      background: "rgba(15,23,42,0.7)",
                      borderRadius: 8, outline: "none", boxSizing: "border-box",
                    }}
                    placeholder="Nhập giá..."
                    value={currentPrices[type] || ""}
                    onChange={(e) =>
                      setCurrentPrices((prev) => ({ ...prev, [type]: formatCurrency(e.target.value) }))
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: windowWidth >= 960 ? "1fr 1fr" : "1fr",
          gap: 24, alignItems: "start",
        }}>

          {/* Thống kê tài sản — có tab */}
          <div style={s.portfolioCard}>
            {/* Tab header */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {(["holding", "sold"] as const).map((tab) => (
                <button
                  key={tab}
                  className="tab-btn"
                  onClick={() => setActiveTab(tab)}
                  style={{
                    flex: 1, padding: "8px 0", borderRadius: 8, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: "bold",
                    background: activeTab === tab
                      ? "linear-gradient(90deg, #fbbf24, #f59e0b)"
                      : "rgba(255,255,255,0.05)",
                    color: activeTab === tab ? "#1e293b" : "#94a3b8",
                  }}
                >
                  {tab === "holding"
                    ? `📦 Đang Giữ (${holdingPurchases.length})`
                    : `✅ Đã Bán (${soldPurchases.length})`}
                </button>
              ))}
            </div>

            {/* Tab: Đang giữ */}
            {activeTab === "holding" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: "bold" }}>📊 Tài Sản Đang Giữ</h3>
                  {summary.allEntered && holdingPurchases.length > 0 && (
                    <span style={badgeStyle(summary.totalProfit)}>
                      {summary.totalProfit >= 0 ? "📈 +" : "📉 "}
                      {Math.abs(summary.totalProfit).toLocaleString("vi-VN")}₫
                    </span>
                  )}
                </div>

                {holdingPurchases.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#475569", fontSize: 13 }}>
                    Chưa có giao dịch nào.<br />Thêm vàng đã mua ở form bên cạnh.
                  </div>
                ) : (
                  <>
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16,
                      background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "1px" }}>TỔNG VỐN</div>
                        <div style={{ fontSize: 17, fontWeight: "bold" }}>{summary.totalInvestment.toLocaleString("vi-VN")}₫</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "1px" }}>GIÁ TRỊ HIỆN TẠI</div>
                        {summary.allEntered ? (
                          <div style={{ fontSize: 17, fontWeight: "bold", color: "#fbbf24" }}>
                            {summary.currentValue.toLocaleString("vi-VN")}₫
                          </div>
                        ) : (
                          <div style={{ fontSize: 12, color: "#475569", fontStyle: "italic" }}>Nhập giá bên trên để xem</div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {summary.rows.map((p) => {
                        const hasSellPrice = parsePrice(currentPrices[p.goldType] || "") > 0;
                        return (
                          <div key={p.id} style={{
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
                            borderRadius: 10, padding: 12,
                          }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 12, fontWeight: "bold", color: "#f1f5f9" }}>{p.goldType}</span>
                                  <span style={{
                                    fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                    background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontWeight: 600,
                                  }}>
                                    {p.purchaseDate ? new Date(p.purchaseDate).toLocaleDateString("vi-VN") : "N/A"}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                  <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.quantity} chỉ</span>
                                  {" × "}{p.purchasePrice.toLocaleString("vi-VN")}₫
                                </div>
                                <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                                  Vốn: {p.investment.toLocaleString("vi-VN")}₫
                                  {p.curPrice > 0 && (
                                    <span style={{ marginLeft: 8 }}>
                                      · Giá hiện tại: <span style={{ color: "#fbbf24" }}>{p.curPrice.toLocaleString("vi-VN")}₫</span>
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 10, flexShrink: 0 }}>
                                <div style={{ textAlign: "right" }}>
                                  {p.profit !== null ? (
                                    <>
                                      <div style={{ fontSize: 13, fontWeight: "bold", color: p.profit >= 0 ? "#4ade80" : "#f87171" }}>
                                        {p.profit >= 0 ? "+" : ""}{p.profit.toLocaleString("vi-VN")}₫
                                      </div>
                                      <div style={{ fontSize: 10, color: "#64748b" }}>{p.profit >= 0 ? "📈 Lãi" : "📉 Lỗ"}</div>
                                    </>
                                  ) : (
                                    <div style={{ fontSize: 11, color: "#334155", fontStyle: "italic" }}>Chưa có giá</div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Hàng nút bên dưới */}
                            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 10 }}>
                              <button
                                className="sell-btn"
                                disabled={!hasSellPrice}
                                onClick={() => handleSell(p)}
                                title={!hasSellPrice ? "Nhập giá hiện tại bên trên để bán" : "Chốt bán với giá hiện tại"}
                                style={{
                                  padding: "5px 14px", borderRadius: 7, fontSize: 12, fontWeight: "bold",
                                  border: "1px solid",
                                  cursor: hasSellPrice ? "pointer" : "not-allowed",
                                  background: hasSellPrice ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.03)",
                                  borderColor: hasSellPrice ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.07)",
                                  color: hasSellPrice ? "#4ade80" : "#334155",
                                  opacity: hasSellPrice ? 1 : 0.5,
                                }}
                              >
                                💸 Đã Bán
                              </button>
                              <button
                                onClick={() => handleDelete(p.id)}
                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 16, padding: 4 }}
                                title="Xóa"
                              >🗑️</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </>
            )}

            {/* Tab: Đã bán */}
            {activeTab === "sold" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: "bold" }}>✅ Lịch Sử Đã Bán</h3>
                  {soldPurchases.length > 0 && (
                    <span style={badgeStyle(soldSummary.totalProfit)}>
                      {soldSummary.totalProfit >= 0 ? "📈 +" : "📉 "}
                      {Math.abs(soldSummary.totalProfit).toLocaleString("vi-VN")}₫
                    </span>
                  )}
                </div>

                {soldPurchases.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "30px 0", color: "#475569", fontSize: 13 }}>
                    Chưa có giao dịch nào được chốt bán.
                  </div>
                ) : (
                  <>
                    {/* Tổng kết đã bán */}
                    <div style={{
                      display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16,
                      background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: 14,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "1px" }}>TỔNG VỐN BỎ RA</div>
                        <div style={{ fontSize: 14, fontWeight: "bold" }}>{soldSummary.totalInvestment.toLocaleString("vi-VN")}₫</div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "1px" }}>THU VỀ</div>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: "#fbbf24" }}>{soldSummary.totalRevenue.toLocaleString("vi-VN")}₫</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 10, color: "#64748b", marginBottom: 4, letterSpacing: "1px" }}>THỰC LÃI / LỖ</div>
                        <div style={{ fontSize: 14, fontWeight: "bold", color: soldSummary.totalProfit >= 0 ? "#4ade80" : "#f87171" }}>
                          {soldSummary.totalProfit >= 0 ? "+" : ""}{soldSummary.totalProfit.toLocaleString("vi-VN")}₫
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {soldSummary.rows.map((p) => (
                        <div key={p.id} style={{
                          background: "rgba(255,255,255,0.03)",
                          border: `1px solid ${p.profit >= 0 ? "rgba(74,222,128,0.15)" : "rgba(248,113,113,0.15)"}`,
                          borderRadius: 10, padding: 12,
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 4 }}>
                                <span style={{ fontSize: 12, fontWeight: "bold", color: "#f1f5f9" }}>{p.goldType}</span>
                                <span style={{
                                  fontSize: 10, padding: "1px 6px", borderRadius: 4,
                                  background: "rgba(74,222,128,0.1)", color: "#4ade80", fontWeight: 600,
                                }}>
                                  ✅ Bán {p.sellDate ? new Date(p.sellDate).toLocaleDateString("vi-VN") : "N/A"}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, color: "#94a3b8" }}>
                                <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.quantity} chỉ</span>
                              </div>
                              <div style={{ fontSize: 11, color: "#475569", marginTop: 3, display: "flex", flexDirection: "column", gap: 2 }}>
                                <span>Giá mua: <span style={{ color: "#94a3b8" }}>{p.purchasePrice.toLocaleString("vi-VN")}₫/chỉ</span></span>
                                <span>Giá bán: <span style={{ color: "#fbbf24" }}>{(p.sellPrice || 0).toLocaleString("vi-VN")}₫/chỉ</span></span>
                                <span>Vốn: {p.investment.toLocaleString("vi-VN")}₫ → Thu: {p.revenue.toLocaleString("vi-VN")}₫</span>
                              </div>
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, marginLeft: 10, flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: "bold", color: p.profit >= 0 ? "#4ade80" : "#f87171" }}>
                                {p.profit >= 0 ? "+" : ""}{p.profit.toLocaleString("vi-VN")}₫
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>{p.profit >= 0 ? "📈 Lãi" : "📉 Lỗ"}</div>
                              <button
                                onClick={() => handleDelete(p.id)}
                                style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: 15, padding: 2, marginTop: 4 }}
                                title="Xóa"
                              >🗑️</button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          {/* Form thêm giao dịch */}
          <div style={s.formCard}>
            <h3 style={{ fontSize: 15, fontWeight: "bold", color: "#fbbf24", margin: "0 0 16px" }}>
              ➕ Thêm Vàng Đã Mua
            </h3>
            <form onSubmit={handleSave}>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Loại vàng</label>
                <select
                  style={{ ...s.input, cursor: "pointer" }}
                  value={selectedGoldType}
                  onChange={(e) => setSelectedGoldType(e.target.value)}
                >
                  {FIXED_GOLD_TYPES.map((t) => (
                    <option key={t} value={t} style={{ background: "#1e293b" }}>{t}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Ngày mua</label>
                  <input style={s.input} type="date" value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)} />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={s.label}>Số chỉ</label>
                  <input style={s.input} type="number" step="0.01" placeholder="0.00"
                    value={purchaseQuantity} onChange={(e) => setPurchaseQuantity(e.target.value)} />
                </div>
              </div>
              <div style={{ marginBottom: 4 }}>
                <label style={s.label}>Giá mua (VNĐ / chỉ)</label>
                <input style={s.input} type="text" placeholder="Ví dụ: 8.500.000"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(formatCurrency(e.target.value))} />
              </div>
              <button type="submit" style={s.btn} disabled={saving}>
                {saving ? "Đang lưu..." : "Lưu Giao Dịch"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoldPriceScreen;