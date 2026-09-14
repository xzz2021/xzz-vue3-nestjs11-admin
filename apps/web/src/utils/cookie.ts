export const CAPTCHA_TEXT_COOKIE = 'captchaText'
const CAPTCHA_COOKIE_MAX_AGE = 5 * 60

export const setCookie = (name: string, value: string, maxAge = CAPTCHA_COOKIE_MAX_AGE) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export const clearCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}
