const ORIGIN = "https://suciagus1719-hash.github.io";
function guessPlatform(name=""){ const n=name.toLowerCase();
  if(n.includes("tiktok"))return"TikTok"; if(n.includes("instagram"))return"Instagram";
  if(n.includes("youtube"))return"YouTube"; if(n.includes("facebook"))return"Facebook";
  if(n.includes("telegram"))return"Telegram"; if(n.includes("twitter")||n.includes("x"))return"Twitter/X";
  if(n.includes("shopee")||n.includes("tokopedia")||n.includes("bukalapak"))return"Shopee"; return"Other";
}

export default async function handler(req,res){
  res.setHeader("Access-Control-Allow-Origin", ORIGIN);
  res.setHeader("Access-Control-Allow-Methods","GET,OPTIONS");
  if(req.method==="OPTIONS")return res.status(204).end();
  if(req.method!=="GET")return res.status(405).end();

  const platform = String(req.query.platform||"").trim();
  const FALLBACK = ["Followers","Likes","Views","Comments","Shares","Other"];

  try{
    const API=process.env.SMMPANEL_BASE_URL, KEY=process.env.SMMPANEL_API_KEY, SEC=process.env.SMMPANEL_SECRET;
    if(!API||!KEY||!SEC) return res.status(200).json(FALLBACK);

    const form=new URLSearchParams({api_key:KEY,secret_key:SEC,action:"services"});
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Accept":"application/json"},body:form});
    const text=await r.text(); let list; try{list=JSON.parse(text);}catch{list=[];}

    const cats=new Set();
    for(const s of list){
      if(guessPlatform(String(s?.name||s?.category||""))===platform){
        const cat = String(s?.category || s?.type || "Other").trim();
        if (cat) cats.add(cat);
      }
    }
    const out=Array.from(cats);
    return res.status(200).json(out.length?out:FALLBACK);
  }catch{
    return res.status(200).json(FALLBACK);
  }
}
