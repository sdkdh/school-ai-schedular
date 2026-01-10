import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";

export default function CalendarPage() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  const [date, setDate] = useState(new Date());

  // 개인 일정(선택한 날짜)
  const [personalSchedules, setPersonalSchedules] = useState([]);
  const [newPersonalTitle, setNewPersonalTitle] = useState("");

  // ✅ 이번 달 개인 일정이 "존재하는 날짜들" (점 표시용)
  const [personalDatesInMonth, setPersonalDatesInMonth] = useState([]);

  // 주요 일정(선택한 날짜가 속한 월 전체)
  const [majorSchedules, setMajorSchedules] = useState([]);
  const [newMajorTitle, setNewMajorTitle] = useState("");

  // 상태/에러 표시
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 수정 상태(개인/주요)
  const [editingPersonalIndex, setEditingPersonalIndex] = useState(null);
  const [editingPersonalValue, setEditingPersonalValue] = useState("");

  const [editingMajorId, setEditingMajorId] = useState(null);
  const [editingMajorValue, setEditingMajorValue] = useState("");

  // AI(버튼 유지)
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const dateKey = useMemo(() => date.toLocaleDateString("sv-SE"), [date]); // YYYY-MM-DD
  const monthKey = useMemo(() => dateKey.slice(0, 7), [dateKey]); // YYYY-MM

  // ✅ Render 주소 (너 주소로!)
  const RENDER_BASE_URL = "https://school-ai-ai-server.onrender.com";
  const AI_URL = `${RENDER_BASE_URL}/aiSummary`;

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === "admin@test.com");
    });
    return () => unsub();
  }, []);

  const loadPersonal = async () => {
    if (!user) return;
    try {
      const ref = doc(db, "users", user.uid, "personal", dateKey);
      const snap = await getDoc(ref);
      setPersonalSchedules(snap.exists() ? snap.data().items : []);
    } catch (e) {
      console.error("loadPersonal error:", e);
      setErrorMsg(`개인 일정 불러오기 실패: ${e?.message || e}`);
    }
  };

  // ✅ 이번 달 개인 일정이 있는 날짜 목록 로드 (점 표시용)
  const loadPersonalDatesInMonth = async () => {
    if (!user) return;
    try {
      const colRef = collection(db, "users", user.uid, "personal");
      const snap = await getDocs(colRef);

      // 문서 id가 YYYY-MM-DD 라고 가정 (지금 구조가 그렇게 저장 중)
      const ids = snap.docs.map((d) => d.id);

      // 이번 달만 필터
      const filtered = ids.filter((id) => typeof id === "string" && id.startsWith(monthKey));

      // items가 비어있는 문서는 점 안 찍고 싶으면 여기서 추가 필터 가능하지만,
      // 현재는 "문서가 있으면 일정이 있다고 간주" (프로토타입에 충분)
      setPersonalDatesInMonth(filtered);
    } catch (e) {
      console.error("loadPersonalDatesInMonth error:", e);
      setErrorMsg(`개인 일정 날짜 불러오기 실패: ${e?.message || e}`);
      setPersonalDatesInMonth([]);
    }
  };

  const loadMajorForMonth = async () => {
    try {
      const majorsRef = collection(db, "major_schedules");
      const q = query(
        majorsRef,
        where("month", "==", monthKey),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      setMajorSchedules(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("loadMajorForMonth error:", e);
      setErrorMsg(`주요 일정 불러오기 실패: ${e?.message || e}`);
    }
  };

  useEffect(() => {
    setStatusMsg("");
    setErrorMsg("");
    setAiText("");

    setEditingPersonalIndex(null);
    setEditingPersonalValue("");
    setEditingMajorId(null);
    setEditingMajorValue("");

    loadPersonal();
    loadMajorForMonth();
    loadPersonalDatesInMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, dateKey, monthKey]);

  // -------------------
  // 개인 일정 추가/삭제/수정
  // -------------------
  const addPersonal = async () => {
    setStatusMsg("");
    setErrorMsg("");
    if (!user) return;
    if (!newPersonalTitle.trim()) return;

    try {
      const ref = doc(db, "users", user.uid, "personal", dateKey);
      const snap = await getDoc(ref);
      const existing = snap.exists() ? snap.data().items : [];

      await setDoc(ref, { items: [...existing, { title: newPersonalTitle.trim() }] });
      setNewPersonalTitle("");
      setStatusMsg("✅ 개인 일정 추가 완료");
      await loadPersonal();
      await loadPersonalDatesInMonth(); // ✅ 점 표시 갱신
    } catch (e) {
      console.error("addPersonal error:", e);
      setErrorMsg(`개인 일정 추가 실패: ${e?.message || e}`);
    }
  };

  const deletePersonal = async (index) => {
    setStatusMsg("");
    setErrorMsg("");
    if (!user) return;

    try {
      const ref = doc(db, "users", user.uid, "personal", dateKey);
      const next = [...personalSchedules];
      next.splice(index, 1);

      await setDoc(ref, { items: next });
      setStatusMsg("✅ 개인 일정 삭제 완료");
      await loadPersonal();
      await loadPersonalDatesInMonth(); // ✅ 점 표시 갱신(일정 다 지우면 문서는 남아있을 수 있음)
    } catch (e) {
      console.error("deletePersonal error:", e);
      setErrorMsg(`개인 일정 삭제 실패: ${e?.message || e}`);
    }
  };

  const startEditPersonal = (index) => {
    setEditingPersonalIndex(index);
    setEditingPersonalValue(personalSchedules[index]?.title ?? "");
  };

  const saveEditPersonal = async () => {
    setStatusMsg("");
    setErrorMsg("");
    if (!user) return;
    if (editingPersonalIndex === null) return;
    if (!editingPersonalValue.trim()) return;

    try {
      const ref = doc(db, "users", user.uid, "personal", dateKey);
      const next = [...personalSchedules];
      next[editingPersonalIndex] = { title: editingPersonalValue.trim() };
      await setDoc(ref, { items: next });

      setEditingPersonalIndex(null);
      setEditingPersonalValue("");
      setStatusMsg("✅ 개인 일정 수정 완료");
      await loadPersonal();
      await loadPersonalDatesInMonth(); // ✅ 점 표시 갱신
    } catch (e) {
      console.error("saveEditPersonal error:", e);
      setErrorMsg(`개인 일정 수정 실패: ${e?.message || e}`);
    }
  };

  // -------------------
  // 주요 일정 추가/삭제/수정(관리자만)
  // -------------------
  const addMajor = async () => {
    setStatusMsg("");
    setErrorMsg("");
    if (!isAdmin) return setErrorMsg("관리자만 주요 일정을 추가할 수 있어.");
    if (!newMajorTitle.trim()) return;

    try {
      await addDoc(collection(db, "major_schedules"), {
        title: newMajorTitle.trim(),
        date: dateKey,
        month: monthKey,
        createdAt: Date.now(),
      });

      setNewMajorTitle("");
      setStatusMsg("✅ 주요 일정 추가 완료");
      await loadMajorForMonth(); // ✅ 점 표시 갱신(majorSchedules 변경)
    } catch (e) {
      console.error("addMajor error:", e);
      setErrorMsg(`주요 일정 추가 실패: ${e?.message || e}`);
    }
  };

  const deleteMajor = async (id) => {
    setStatusMsg("");
    setErrorMsg("");
    if (!isAdmin) return setErrorMsg("관리자만 주요 일정을 삭제할 수 있어.");

    try {
      await deleteDoc(doc(db, "major_schedules", id));
      setStatusMsg("✅ 주요 일정 삭제 완료");
      await loadMajorForMonth();
    } catch (e) {
      console.error("deleteMajor error:", e);
      setErrorMsg(`주요 일정 삭제 실패: ${e?.message || e}`);
    }
  };

  const startEditMajor = (m) => {
    if (!isAdmin) return;
    setEditingMajorId(m.id);
    setEditingMajorValue(m.title ?? "");
  };

  const saveEditMajor = async () => {
    setStatusMsg("");
    setErrorMsg("");
    if (!isAdmin) return setErrorMsg("관리자만 주요 일정을 수정할 수 있어.");
    if (!editingMajorId) return;
    if (!editingMajorValue.trim()) return;

    try {
      await updateDoc(doc(db, "major_schedules", editingMajorId), {
        title: editingMajorValue.trim(),
      });
      setEditingMajorId(null);
      setEditingMajorValue("");
      setStatusMsg("✅ 주요 일정 수정 완료");
      await loadMajorForMonth();
    } catch (e) {
      console.error("saveEditMajor error:", e);
      setErrorMsg(`주요 일정 수정 실패: ${e?.message || e}`);
    }
  };

  // -------------------
  // AI 요약(버튼 유지)
  // -------------------
  const runAiSummary = async () => {
    setStatusMsg("");
    setErrorMsg("");
    setAiText("");

    try {
      setAiLoading(true);

      const payload = {
        monthKey,
        selectedDate: dateKey,
        majors: majorSchedules.map((m) => ({ date: m.date, title: m.title })),
        personals: personalSchedules.map((p) => ({ title: p.title })),
      };

      const r = await fetch(AI_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      setAiText(data.text || "(AI 응답이 비어있음)");
      setStatusMsg("✅ AI 요약 생성 완료");
    } catch (e) {
      console.error("runAiSummary error:", e);
      setErrorMsg(`AI 요약 실패: ${e?.message || e}`);
    } finally {
      setAiLoading(false);
    }
  };

  // -------------------
  // ✅ 점 표시용 날짜 Set 만들기
  // -------------------
  const scheduleDateSet = useMemo(() => {
    const set = new Set();

    // major 일정 날짜
    for (const m of majorSchedules) {
      if (m?.date) set.add(m.date);
    }

    // personal 일정 존재 날짜(이번 달)
    for (const d of personalDatesInMonth) {
      set.add(d);
    }

    return set;
  }, [majorSchedules, personalDatesInMonth]);

  // -------------------
  // UI helper styles
  // -------------------
  const styles = {
    page: { padding: 16, maxWidth: 760, margin: "0 auto" },
    topBar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      padding: "12px 14px",
      border: "1px solid #e5e5e5",
      borderRadius: 12,
      background: "#fff",
      marginBottom: 14,
    },
    title: { fontSize: 18, fontWeight: 800, margin: 0 },
    pill: {
      fontSize: 12,
      padding: "4px 8px",
      borderRadius: 999,
      border: "1px solid #e5e5e5",
      background: "#fafafa",
      whiteSpace: "nowrap",
    },
    grid: {
      display: "grid",
      gridTemplateColumns: "1.1fr 0.9fr",
      gap: 12,
      alignItems: "start",
    },
    card: {
      border: "1px solid #e5e5e5",
      borderRadius: 12,
      padding: 12,
      background: "#fff",
    },
    cardTitle: { fontSize: 14, fontWeight: 800, margin: "0 0 10px 0" },
    row: { display: "flex", gap: 8, alignItems: "center" },
    input: {
      flex: 1,
      padding: "10px 10px",
      borderRadius: 10,
      border: "1px solid #ddd",
      outline: "none",
    },
    btn: {
      padding: "10px 12px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: "pointer",
      whiteSpace: "nowrap",
      fontWeight: 700,
    },
    btnSmall: {
      fontSize: "0.8rem",
      padding: "6px 10px",
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "#fff",
      cursor: "pointer",
      marginLeft: 6,
    },
    msgOk: { border: "1px solid #cfc", background: "#f6fff6", padding: 10, borderRadius: 10, marginBottom: 10 },
    msgErr: { border: "1px solid #fbb", background: "#fff6f6", padding: 10, borderRadius: 10, marginBottom: 10 },
    list: { listStyle: "none", padding: 0, margin: 0 },
    item: { padding: "8px 8px", borderBottom: "1px solid #eee" },

    // ✅ 점(●) 스타일
    dotWrap: { display: "flex", justifyContent: "center", marginTop: 2 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: "50%",
      background: "#111",
    },

    pre: { whiteSpace: "pre-wrap", background: "#f7f7f7", padding: 10, borderRadius: 10, marginTop: 10 },
  };

  // ✅ react-calendar: 날짜 타일에 점 추가
  const tileContent = ({ date: tileDate, view }) => {
    if (view !== "month") return null;
    const key = tileDate.toLocaleDateString("sv-SE");
    if (!scheduleDateSet.has(key)) return null;

    return (
      <div style={styles.dotWrap}>
        <div style={styles.dot} />
      </div>
    );
  };

  return (
    <div style={styles.page}>
      <div style={styles.topBar}>
        <h2 style={styles.title}>학교 일정 관리</h2>
        <div style={styles.pill}>
          {user ? (
            <>
              <b>{user.email}</b> {isAdmin && "(관리자)"}
            </>
          ) : (
            "로그인 확인 중..."
          )}
        </div>
      </div>

      {statusMsg && <div style={styles.msgOk}>{statusMsg}</div>}
      {errorMsg && <div style={styles.msgErr}>{errorMsg}</div>}

      <div style={styles.grid}>
        {/* 왼쪽: 달력 + 개인 일정 */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>달력</div>
          <Calendar value={date} onChange={setDate} tileContent={tileContent} />

          <div style={{ height: 12 }} />

          <div style={styles.cardTitle}>선택 날짜 개인 일정: {dateKey}</div>

          {personalSchedules.length === 0 ? (
            <div style={{ color: "#666" }}>없음</div>
          ) : (
            <ul style={styles.list}>
              {personalSchedules.map((p, i) => (
                <li key={i} style={styles.item}>
                  {editingPersonalIndex === i ? (
                    <div style={styles.row}>
                      <input
                        style={styles.input}
                        value={editingPersonalValue}
                        onChange={(e) => setEditingPersonalValue(e.target.value)}
                      />
                      <button style={styles.btnSmall} onClick={saveEditPersonal}>
                        저장
                      </button>
                      <button
                        style={styles.btnSmall}
                        onClick={() => {
                          setEditingPersonalIndex(null);
                          setEditingPersonalValue("");
                        }}
                      >
                        취소
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                      <span>{p.title}</span>
                      <span>
                        <button style={styles.btnSmall} onClick={() => startEditPersonal(i)}>
                          수정
                        </button>
                        <button style={styles.btnSmall} onClick={() => deletePersonal(i)}>
                          삭제
                        </button>
                      </span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div style={{ height: 10 }} />
          <div style={styles.row}>
            <input
              style={styles.input}
              value={newPersonalTitle}
              onChange={(e) => setNewPersonalTitle(e.target.value)}
              placeholder="개인 일정 추가"
            />
            <button style={styles.btn} onClick={addPersonal}>
              추가
            </button>
          </div>
        </div>

        {/* 오른쪽: 주요 일정 + AI */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={styles.card}>
            <div style={styles.cardTitle}>{monthKey} 주요 일정</div>

            {majorSchedules.length === 0 ? (
              <div style={{ color: "#666" }}>없음</div>
            ) : (
              <ul style={styles.list}>
                {majorSchedules.map((m) => (
                  <li key={m.id} style={styles.item}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                      <div>
                        <b>{m.date}</b> —{" "}
                        {editingMajorId === m.id ? (
                          <input
                            style={{ ...styles.input, marginTop: 6 }}
                            value={editingMajorValue}
                            onChange={(e) => setEditingMajorValue(e.target.value)}
                          />
                        ) : (
                          m.title
                        )}
                      </div>

                      {isAdmin && (
                        <div style={{ whiteSpace: "nowrap" }}>
                          {editingMajorId === m.id ? (
                            <>
                              <button style={styles.btnSmall} onClick={saveEditMajor}>
                                저장
                              </button>
                              <button
                                style={styles.btnSmall}
                                onClick={() => {
                                  setEditingMajorId(null);
                                  setEditingMajorValue("");
                                }}
                              >
                                취소
                              </button>
                            </>
                          ) : (
                            <>
                              <button style={styles.btnSmall} onClick={() => startEditMajor(m)}>
                                수정
                              </button>
                              <button style={styles.btnSmall} onClick={() => deleteMajor(m.id)}>
                                삭제
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {isAdmin && (
              <>
                <div style={{ height: 10 }} />
                <div style={styles.row}>
                  <input
                    style={styles.input}
                    value={newMajorTitle}
                    onChange={(e) => setNewMajorTitle(e.target.value)}
                    placeholder="주요 일정 추가(선택한 날짜로 등록)"
                  />
                  <button style={styles.btn} onClick={addMajor}>
                    추가
                  </button>
                </div>
              </>
            )}
          </div>

          <div style={styles.card}>
            <div style={styles.cardTitle}>AI 요약(설계/연동 테스트 완료)</div>
            <div style={{ color: "#666", fontSize: 12, marginBottom: 8 }}>
              ※ 현재 OpenAI API 사용량 제한(429)
            </div>
            <button style={styles.btn} onClick={runAiSummary} disabled={aiLoading}>
              {aiLoading ? "생성 중..." : "AI 요약 생성하기"}
            </button>

            {aiText && <pre style={styles.pre}>{aiText}</pre>}
          </div>
        </div>
      </div>
    </div>
  );
}
