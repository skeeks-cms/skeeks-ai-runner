import {spawn} from "node:child_process";

const profiles={vclaude:"skeeks-claude",personal:"skeeks-claude-personal"};
export function createClaudeEngine(profile){
  if(!Object.hasOwn(profiles,profile))throw Error("Не выбран профиль Claude.");
  return {id:"claude-"+profile,async runStep({binding,sessionId,turn,image}){
    const {SKEEKS_AI_SSH_IDENTITY:key,SKEEKS_AI_HOST_KEY:alias,SKEEKS_AI_SSH_HOST:host}=process.env;
    if(!key || !alias || !host)throw Error("Не настроено соединение с раннером.");
    const command="runuser -u "+profiles[profile]+" -- /usr/local/bin/node /opt/skeeks-ai/claude/claude-turn.mjs "+profile;
    return new Promise((resolve,reject)=>{
      const child=spawn("ssh",["-T","-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o","ConnectTimeout=8","-o","HostKeyAlias="+alias,"-i",key,host,command],{windowsHide:true,stdio:["pipe","pipe","ignore"]});
      let output="";
      const timeout=setTimeout(()=>child.kill(),105000);
      child.stdout.setEncoding("utf8").on("data",part=>{output+=part;if(output.length>64000)child.kill();});
      child.on("error",reject);
      child.on("close",code=>{
        clearTimeout(timeout);
        if(code===42)return reject(Error("Для профиля VClaude не настроен ключ."));
        const reasons={43:"Провайдер сообщил об ограничении тарифа или баланса.",44:"Провайдер ограничил частоту запросов.",45:"Превышен размер контекста Claude.",46:"Claude завершил запрос с ошибкой SDK или провайдера.",47:"Claude вернул ответ вне формата JSON."};
        if(reasons[code])return reject(Error(reasons[code]));
        if(code!==0)return reject(Error("Claude Agent SDK не завершил шаг. Проверьте подключение, модель и лимит профиля."));
        try{resolve(JSON.parse(output));}catch{reject(Error("Некорректный ответ Claude Agent SDK."));}
      });
      child.stdin.on("error",()=>{});
      child.stdin.end(JSON.stringify({binding,sessionId,turn,image}));
    });
  }};
}
