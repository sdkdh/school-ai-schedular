import { useEffect, useState } from "react";
import {
  onAuthStateChanged,
  signOut,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import { auth } from "./firebase";
import LoginPage from "./pages/LoginPage";
import CalendarPage from "./pages/CalendarPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ 비밀번호 변경 토글
  const [showPw, setShowPw] = useState(false);

  // 비밀번호 변경 입력값
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      console.log("Auth state:", currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleChangePassword = async () => {
    setPwMsg("");
    if (!user?.email) return;

    if (!currentPw || !newPw) {
      setPwMsg("현재 비밀번호와 새 비밀번호를 모두 입력해줘.");
      return;
    }
    if (newPw.length < 6) {
      setPwMsg("새 비밀번호는 6자 이상이어야 해.");
      return;
    }

    try {
      setPwLoading(true);

      // 1) 재인증(현재 비밀번호 필요)
      const cred = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, cred);

      // 2) 비밀번호 변경
      await updatePassword(user, newPw);

      setPwMsg("✅ 비밀번호 변경 완료!");
      setCurrentPw("");
      setNewPw("");
      setShowPw(false); // ✅ 성공하면 자동으로 닫기
    } catch (e) {
      setPwMsg(`❌ 비밀번호 변경 실패: ${e?.message || e}`);
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 16 }}>로딩 중...</div>;
  if (!user) return <LoginPage />;

  return (
    <div style={{ padding: 16 }}>
      {/* ✅ 상단: "email [비밀번호 변경] [로그아웃]" 한 줄 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600 }}>{user.email}</div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowPw((v) => !v)}>
            {showPw ? "닫기" : "비밀번호 변경"}
          </button>
          <button onClick={handleLogout}>로그아웃</button>
        </div>
      </div>

      {/* ✅ 비밀번호 변경 UI: showPw일 때만 표시 */}
      {showPw && (
        <div
          style={{
            border: "1px solid #ddd",
            borderRadius: 8,
            padding: 12,
            marginBottom: 16,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>비밀번호 변경</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              placeholder="현재 비밀번호"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
            />
            <input
              type="password"
              placeholder="새 비밀번호 (6자 이상)"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
            />
            <button onClick={handleChangePassword} disabled={pwLoading}>
              {pwLoading ? "변경 중..." : "변경"}
            </button>
          </div>

          {pwMsg && <div style={{ marginTop: 8 }}>{pwMsg}</div>}
        </div>
      )}

      <CalendarPage />
    </div>
  );
}

export default App;
