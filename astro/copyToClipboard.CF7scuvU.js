async function t(r){if(!navigator.clipboard?.writeText)return!1;try{return await navigator.clipboard.writeText(r),!0}catch{return!1}}export{t as w};
