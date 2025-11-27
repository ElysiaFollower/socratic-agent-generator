export default function authHeader() {
  const userStr = localStorage.getItem('user');
  let user = null;
  if (userStr)
    user = JSON.parse(userStr);

  if (user && user.access_token) {
    return { Authorization: 'Bearer ' + user.access_token };
  } else {
    return { Authorization: '' };
  }
}
