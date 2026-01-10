import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { useEffect, useState } from "react";
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

  // ✅ AI 요약 결과
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const dateKey = date.toLocaleDateString("sv-SE"); // YYYY-MM-DD
  const monthKey = dateKey.slice(0, 7); // YYYY-MM

  // ✅ Render 서버 주소(너 URL로 바꿔!)
  const RENDER_BASE_URL = "https://YOUR-RENDER-SERVICE.onrender.com";
  const AI_URL = `${RENDER_BASE_URL}/aiSummary`;

  // -------------------
  // 로그인 / 관리자
  // -------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === "admin@test.com");
    });
    return () => unsub();
  }, []);

  // -------------------
  // 개인 일정 로드
  // -------------------
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

  // -------------------
  // 주요 일정 로드(월)
  // -------------------
  const loadMajorForMonth = async () => {
    try {
      const majorsRef = collection(db, "major_schedules");
      const q = query(
        majorsRef,
        where("month", "==", monthKey),
        orderBy("date", "asc")
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMajorSchedules(items);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date]);

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

      await setDoc(ref, { items: [...existing, { title: newPersonalTitle }] });
      setNewPersonalTitle("");
      setStatusMsg("✅ 개인 일정 추가 완료");
      loadPersonal();
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
      loadPersonal();
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
      next[editingPersonalIndex] = { title: editingPersonalValue };
      await setDoc(ref, { items: next });

      setEditingPersonalIndex(null);
      setEditingPersonalValue("");
      setStatusMsg("✅ 개인 일정 수정 완료");
      loadPersonal();
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
    if (!isAdmin) {
      setErrorMsg("관리자만 주요 일정을 추가할 수 있어.");
      return;
    }
    if (!newMajorTitle.trim()) return;

    try {
      await addDoc(collection(db, "major_schedules"), {
        title: newMajorTitle,
        date: dateKey,
        month: monthKey,
        createdAt: Date.now(),
      });

      setNewMajorTitle("");
      setStatusMsg("✅ 주요 일정 추가 완료");
      loadMajorForMonth();
    } catch (e) {
      console.error("addMajor error:", e);
      setErrorMsg(`주요 일정 추가 실패: ${e?.message || e}`);
    }
  };

  const deleteMajor = async (id) => {
    setStatusMsg("");
    setErrorMsg("");
    if (!isAdmin) {
      setErrorMsg("관리자만 주요 일정을 삭제할 수 있어.");
      return;
    }
    try {
      await deleteDoc(doc(db, "major_schedules", id));
      setStatusMsg("✅ 주요 일정 삭제 완료");
      loadMajorForMonth();
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
    if (!isAdmin) {
      setErrorMsg("관리자만 주요 일정을 수정할 수 있어.");
      return;
    }
    if (!editingMajorId) return;
    if (!editingMajorValue.trim()) return;

    try {
      await updateDoc(doc(db, "major_schedules", editingMajorId), {
        title: editingMajorValue,
      });

      setEditingMajorId(null);
      setEditingMajorValue("");
      setStatusMsg("✅ 주요 일정 수정 완료");
      loadMajorForMonth();
    } catch (e) {
      console.error("saveEditMajor error:", e);
      setErrorMsg(`주요 일정 수정 실패: ${e?.message || e}`);
    }
  };

  // -------------------
  // ✅ AI 요약 버튼
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

      const data = await r.json();
      if (!r.ok) throw new Error(data?.error || "AI 요청 실패");

      setAiText(data.text || "(AI 응답이 비어있음)");
      setStatusMsg("✅ AI 요약 생성 완료");
    } catch (e) {
      console.error("runAiSummary error:", e);
      setErrorMsg(`AI 요약 실패: ${e?.message || e}`);
    } finally {
      setAiLoading(false);
    }
  };

  const smallBtn = { fontSize: "0.75rem", padding: "2px 6px", marginLeft: 6 };

  return (
    <div style={{ padding: 20, maxWidth: 560, margin: "0 auto" }}>
      <h2>학교 일정 관리</h2>

      {user ? (
        <div style={{ marginBottom: 10 }}>
          <b>{user.email}</b> {isAdmin && "(관리자)"}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>로그인 확인 중...</div>
      )}

      {statusMsg && (
        <div style={{ marginBottom: 10, padding: 8, border: "1px solid #cfc" }}>
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ marginBottom: 10, padding: 8, border: "1px solid #fbb" }}>
          {errorMsg}
        </div>
      )}

      {/* ✅ AI 요약 */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          AI 이번 달 요약/우선순위 추천
        </div>
        <button onClick={runAiSummary} disabled={aiLoading}>
          {aiLoading ? "생성 중..." : "AI 요약 생성하기"}
        </button>

        {aiText && (
          <pre
            style={{
              marginTop: 10,
              whiteSpace: "pre-wrap",
              background: "#f7f7f7",
              padding: 10,
              borderRadius: 8,
            }}
          >
            {aiText}
          </pre>
        )}
      </div>

      {/* ✅ 월 주요 일정 */}
      <h3>{monthKey} 주요 일정</h3>
      {majorSchedules.length === 0 ? (
        <p>없음</p>
      ) : (
        <ul>
          {majorSchedules.map((m) => (
            <li key={m.id} style={{ marginBottom: 6 }}>
              <b>{m.date}</b>{" "}
              {editingMajorId === m.id ? (
                <>
                  <input
                    value={editingMajorValue}
                    onChange={(e) => setEditingMajorValue(e.target.value)}
                  />
                  <button style={smallBtn} onClick={saveEditMajor}>
                    저장
                  </button>
                  <button
                    style={smallBtn}
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
                  - {m.title}
                  {isAdmin && (
                    <>
                      <button style={smallBtn} onClick={() => startEditMajor(m)}>
                        수정
                      </button>
                      <button style={smallBtn} onClick={() => deleteMajor(m.id)}>
                        삭제
                      </button>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <input
            value={newMajorTitle}
            onChange={(e) => setNewMajorTitle(e.target.value)}
            placeholder="주요 일정 추가 (선택한 날짜로 등록됨)"
          />
          <button style={{ marginLeft: 6 }} onClick={addMajor}>
            추가
          </button>
        </div>
      )}

      <Calendar value={date} onChange={setDate} />

      {/* ✅ 선택 날짜 개인 일정 */}
      <h3 style={{ marginTop: 16 }}>선택 날짜 개인 일정: {dateKey}</h3>
      {personalSchedules.length === 0 ? (
        <p>없음</p>
      ) : (
        <ul>
          {personalSchedules.map((p, i) => (
            <li key={i} style={{ marginBottom: 6 }}>
              {editingPersonalIndex === i ? (
                <>
                  <input
                    value={editingPersonalValue}
                    onChange={(e) => setEditingPersonalValue(e.target.value)}
                  />
                  <button style={smallBtn} onClick={saveEditPersonal}>
                    저장
                  </button>
                  <button
                    style={smallBtn}
                    onClick={() => {
                      setEditingPersonalIndex(null);
                      setEditingPersonalValue("");
                    }}
                  >
                    취소
                  </button>
                </>
              ) : (
                <>
                  {p.title}
                  <button style={smallBtn} onClick={() => startEditPersonal(i)}>
                    수정
                  </button>
                  <button style={smallBtn} onClick={() => deletePersonal(i)}>
                    삭제
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 10 }}>
        <input
          value={newPersonalTitle}
          onChange={(e) => setNewPersonalTitle(e.target.value)}
          placeholder="개인 일정 추가"
        />
        <button style={{ marginLeft: 6 }} onClick={addPersonal}>
          추가
        </button>
      </div>
    </div>
  );
}
