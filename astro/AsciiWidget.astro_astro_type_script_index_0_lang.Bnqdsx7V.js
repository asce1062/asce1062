import{f as r}from"./feedbackManager.BvxmE4ad.js";function a(t){const{text:e,font:n,art:c}=JSON.parse(t),i=`[${n}]

\`\`\`figlet
`+c+"\n```",o="```json\n"+JSON.stringify({text:e,font:n,art:c},null,2)+"\n```";return i+`

`+o}function s(){document.querySelectorAll(".ascii-widget-copy").forEach(t=>{t.addEventListener("click",async()=>{const e=t.dataset.widgetId;if(!e)return;const c=document.getElementById(e)?.dataset.asciiCurrent;if(c)try{await navigator.clipboard.writeText(a(c)),d(t)}catch{}})})}function d(t){const e=t.querySelector(".ascii-copy-icon"),n=t.querySelector(".ascii-check-icon");!e||!n||r(e,n)}document.addEventListener("astro:page-load",s);
