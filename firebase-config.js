// Firebase Console > 프로젝트 설정 > 일반 > 내 앱 > SDK 설정 및 구성에서 받은 값을 넣으세요.
// Firebase 웹 앱의 설정값은 공개되어도 되는 식별자입니다. 접근 권한은 Firestore 보안 규칙으로 제한합니다.
export const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.firebasestorage.app',
  messagingSenderId: 'YOUR_MESSAGING_SENDER_ID',
  appId: 'YOUR_APP_ID'
};
