export async function apiFetch(url, options = {}) {
 const response=await fetch(url,{credentials:'include',...options});
 if(response.status===401)window.dispatchEvent(new Event('friendforge:signin'));
 return response;
}
