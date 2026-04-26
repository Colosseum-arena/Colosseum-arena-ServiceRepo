/**
 * @module authController
 * @description 인증 관련 API 엔드포인트 핸들러를 제공합니다.
 */

import {
  validateLoginInput,
  validateSignupInput,
  findUserByEmail,
  createUser,
  assertPasswordMatches,
  issueAccessToken,
  enforceRateLimit,
  writeAuditLog
} from './authService.js';

/**
 * 로그인 요청을 처리하는 핸들러 함수입니다.
 * (CLI 환경에서 웹 요청/응답을 시뮬레이션합니다.)
 * @param {object} req - 요청 객체 (body 속성에 로그인 정보 포함)
 * @returns {Promise<object>} 로그인 처리 결과
 */
export async function loginHandler(req) {
  // CLI 환경에서 웹 응답 객체를 시뮬레이션합니다.
  const mockRes = {
    _status: 200,
    _json: null,
    status: function(code) {
      this._status = code;
      return this;
    },
    json: function(data) {
      this._json = data;
      return data; // CLI 컨텍스트를 위해 데이터를 직접 반환
    }
  };

  try {
    const payload = validateLoginInput(req.body);
    await enforceRateLimit(payload.email);
    const user = await findUserByEmail(payload.email);
    await assertPasswordMatches(payload.password, user.passwordHash);
    await writeAuditLog({ type: 'LOGIN_SUCCESS', email: payload.email, userId: user.id });
    const token = issueAccessToken(user.id);
    return mockRes.json({ success: true, token, user: { id: user.id, email: user.email } });
  } catch (error) {
    // 에러 발생 시 감사 로그 기록 (email이 없을 수 있으므로 안전하게 접근)
    await writeAuditLog({ type: 'LOGIN_FAILURE', email: req.body?.email || 'unknown', message: error.message });
    return mockRes.status(401).json({ success: false, message: error.message });
  }
}

/**
 * 회원가입 요청을 처리하는 핸들러 함수입니다.
 * (CLI 환경에서 웹 요청/응답을 시뮬레이션합니다.)
 * @param {object} req - 요청 객체 (body 속성에 회원가입 정보 포함)
 * @returns {Promise<object>} 회원가입 처리 결과
 */
export async function signupHandler(req) {
  const mockRes = {
    _status: 200,
    _json: null,
    status: function(code) {
      this._status = code;
      return this;
    },
    json: function(data) {
      this._json = data;
      return data;
    }
  };

  try {
    const payload = await validateSignupInput(req.body);
    await enforceRateLimit(payload.email);
    const newUser = await createUser(payload);
    await writeAuditLog({ type: 'SIGNUP_SUCCESS', email: newUser.email, userId: newUser.id });
    const token = issueAccessToken(newUser.id);
    return mockRes.status(201).json({ success: true, token, user: { id: newUser.id, email: newUser.email } });
  } catch (error) {
    await writeAuditLog({ type: 'SIGNUP_FAILURE', email: req.body?.email || 'unknown', message: error.message });
    return mockRes.status(400).json({ success: false, message: error.message });
  }
}
