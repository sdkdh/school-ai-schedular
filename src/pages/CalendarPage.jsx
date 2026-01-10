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

  // 달력에서 선택한 날짜(= 개인 일정 조회 기준 + 월 주요 일정 기준)
  const [date, setDate] = useState(new Date());

  // 개인 일정(선택한 날짜의 것만)
  const [personalSchedules, setPersonalSchedules] = useState([]);
  const [newPersonalTitle, setNewPersonalTitle] = useState("");

  // 주요 일정(선택한 날짜가 속한 "월" 전체)
  const [majorSchedules, setMajorSchedules] = useState([]);
  const [newMajorTitle, setNewMajorTitle] = useState("");

  // 상태/에러 표시
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // 수정 상태 (개인/주요 각각)
  const [editingPersonalIndex, setEditingPersonalIndex] = useState(null);
  const [editingPersonalValue, setEditingPersonalValue] = useState("");

  const [editingMajorId, setEditingMajorId] = useState(null);
  const [editingMajorValue, setEditingMajorValue] = useState("");

  // YYYY-MM-DD
  const dateKey = date.toLocaleDateString("sv-SE");
  // YYYY-MM
  const monthKey = dateKey.slice(0, 7);

  // -------------------
  // 로그인 상태 / 관리자 판정
  // -------------------
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === "admin@test.com");
    });
    return () => unsub();
  }, []);

  // -------------------
  // 개인 일정 로드(선택 날짜)
  // users/{uid}/personal/{YYYY-MM-DD}
  // { items: [{ title }] }
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
  // 주요 일정 로드(선택한 날짜가 속한 월 전체)
  // major_schedules 컬렉션
  // 문서: { title, date, month, createdAt }
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
      setErrorMsg(
        `주요 일정 불러오기 실패: ${e?.message || e}\n(인덱스/권한 문제일 수 있음)`
      );
    }
  };

  // 날짜(선택) 바뀔 때마다 로드
  useEffect(() => {
    setStatusMsg("");
    setErrorMsg("");
    setEditingPersonalIndex(null);
    setEditingPersonalValue("");
    setEditingMajorId(null);
    setEditingMajorValue("");

    loadPersonal();
    loadMajorForMonth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, date]);

  // -------------------
  // 개인 일정 추가
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

      await setDoc(ref, {
        items: [...existing, { title: newPersonalTitle }],
      });

      setNewPersonalTitle("");
      setStatusMsg("✅ 개인 일정 추가 완료");
      loadPersonal();
    } catch (e) {
      console.error("addPersonal error:", e);
      setErrorMsg(`개인 일정 추가 실패: ${e?.message || e}`);
    }
  };

  // -------------------
  // 개인 일정 삭제(본인)
  // -------------------
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

  // -------------------
  // 개인 일정 수정 시작
  // -------------------
  const startEditPersonal = (index) => {
    setEditingPersonalIndex(index);
    setEditingPersonalValue(personalSchedules[index]?.title ?? "");
  };

  // -------------------
  // 개인 일정 수정 저장
  // -------------------
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
  // 주요 일정 추가(관리자만)
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
      const docRef = await addDoc(collection(db, "major_schedules"), {
        title: newMajorTitle,
        date: dateKey, // 선택한 날짜에 등록
        month: monthKey,
        createdAt: Date.now(),
      });

      console.log("major added id:", docRef.id);

      setNewMajorTitle("");
      setStatusMsg("✅ 주요 일정 추가 완료");
      loadMajorForMonth();
    } catch (e) {
      console.error("addMajor error:", e);
      setErrorMsg(
        `주요 일정 추가 실패: ${e?.message || e}\n(대부분 Firestore Rules에서 major_schedules 쓰기 권한이 막혀서 그래)`
      );
    }
  };

  // -------------------
  // 주요 일정 삭제(관리자만)
  // -------------------
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

  // -------------------
  // 주요 일정 수정 시작(관리자만)
  // -------------------
  const startEditMajor = (m) => {
    if (!isAdmin) return;
    setEditingMajorId(m.id);
    setEditingMajorValue(m.title ?? "");
  };

  // -------------------
  // 주요 일정 수정 저장(관리자만)
  // -------------------
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

  const smallBtn = {
    fontSize: "0.75rem",
    padding: "2px 6px",
    marginLeft: 6,
  };

  return (
    <div style={{ padding: 20, maxWidth: 520, margin: "0 auto" }}>
      <h2>학교 일정 관리</h2>

      {user ? (
        <div style={{ marginBottom: 10 }}>
          <b>{user.email}</b> {isAdmin && "(관리자)"}
        </div>
      ) : (
        <div style={{ marginBottom: 10 }}>로그인 확인 중...</div>
      )}

      {/* 상태/에러 표시 */}
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

      {/* ✅ 주요 일정: 달(월) 단위로 항상 표시 */}
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

      {/* 관리자만 주요 일정 추가 */}
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

      {/* ✅ 개인 일정: 날짜 클릭했을 때만 그 날짜 일정 표시 */}
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
