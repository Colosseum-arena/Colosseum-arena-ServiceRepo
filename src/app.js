import { loginHandler, signupHandler } from './authController.js';

/**
 * 애플리케이션의 로그인 부트스트랩 함수입니다.
 * 기존 bootstrapLogin의 인터페이스를 유지하며, 새로운 loginHandler를 호출합니다.
 * CLI 환경에서 로그인 기능을 호출하기 위한 진입점 역할을 합니다.
 * @param {object} credentials - 사용자 로그인 정보 (email, password)
 * @returns {Promise<object>} 로그인 결과
 */
export async function bootstrapLogin(credentials) {
  // CLI 환경에서 loginHandler를 호출하기 위한 가상 요청 객체 생성
  const mockReq = {
    body: credentials
  };
  return loginHandler(mockReq);
}

/**
 * 애플리케이션의 회원가입 부트스트랩 함수입니다.
 * CLI 환경에서 회원가입 기능을 호출하기 위한 진입점 역할을 합니다.
 * @param {object} userData - 사용자 회원가입 정보 (email, password, confirmPassword)
 * @returns {Promise<object>} 회원가입 결과
 */
export async function bootstrapSignup(userData) {
  const mockReq = {
    body: userData
  };
  return signupHandler(mockReq);
}

/**
 * 회원가입 기능의 데모 실행 함수입니다.
 * 이 함수는 기존에 구현된 회원가입 기능을 시연하기 위해 추가되었습니다.
 * @returns {Promise<void>}
 */
export async function demoSignup() {
  console.log('--- 회원가입 데모 시작 ---');
  try {
    const newUserEmail = `demo_user_${Date.now()}@example.com`;
    const newUser = {
      email: newUserEmail,
      password: 'demopassword123',
      confirmPassword: 'demopassword123'
    };
    console.log(`[데모] 새 사용자 회원가입 시도: ${newUser.email}`);
    const signupResult = await bootstrapSignup(newUser);
    console.log('[데모] 회원가입 성공:', signupResult);

    // 이미 존재하는 이메일로 다시 회원가입 시도 (에러 처리 확인)
    console.log(`[데모] 이미 존재하는 이메일로 회원가입 시도 (에러 확인): ${newUser.email}`);
    const duplicateSignupResult = await bootstrapSignup(newUser);
    // signupHandler는 에러 발생 시 mockRes.status(400).json(...)을 반환하므로,
    // 여기서는 에러 객체가 아닌 { success: false, message: 'Email is already registered.' } 형태의 객체를 받게 됩니다.
    console.log('[데모] 중복 이메일 회원가입 결과:', duplicateSignupResult);

  } catch (error) {
    console.error('[데모] 회원가입 데모 중 오류 발생:', error.message);
  }
  console.log('--- 회원가입 데모 종료 ---');
}
