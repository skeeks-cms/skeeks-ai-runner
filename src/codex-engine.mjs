import {readFile} from "node:fs/promises";
import {spawn} from "node:child_process";

const sdkSource = await readFile(new URL("./catalog-turn.mjs",import.meta.url), "base64");
const sshHost = process.env.SKEEKS_AI_SSH_HOST;
const sshIdentity = process.env.SKEEKS_AI_SSH_IDENTITY;
const hostKey = process.env.SKEEKS_AI_HOST_KEY;
if (!sshHost || !sshIdentity || !hostKey) throw new Error("Configure the pilot SSH connection.");

function decide(input) {
  const cmd = 'cd /opt/skeeks-ai && runuser -u codex -- /usr/local/bin/node --input-type=module -e "$(printf %s '+sdkSource+' | base64 -d)"';
  return new Promise((resolve,reject)=>{
    const child=spawn("ssh",["-T","-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o","ConnectTimeout=7","-o","HostKeyAlias="+hostKey,"-i",sshIdentity,sshHost,cmd],{windowsHide:true,stdio:["pipe","pipe","ignore"]});
    let output="";
    const timer=setTimeout(()=>child.kill(),95000);
    child.stdout.setEncoding("utf8").on("data",chunk=>{output+=chunk;if(output.length>16000)child.kill();});
    child.on("error",reject);
    child.on("close",code=>{clearTimeout(timer);try{if(code!==0)throw Error();resolve(JSON.parse(output));}catch{reject(new Error("Исполнитель Codex SDK не вернул ответ."));}});
    child.stdin.on("error",()=>{});child.stdin.end(JSON.stringify(input));
  });
}

export const codexEngine = {
  id: "codex",
  async runStep({binding, sessionId, turn, image}) {
    const result = await decide({binding, threadId: sessionId, turn, image});
    if (typeof result.threadId !== "string" || !/^[a-f0-9-]{36}$/.test(result.threadId)) {
      throw new Error("Codex SDK не вернул идентификатор сессии.");
    }
    return {sessionId: result.threadId, step: result.step};
  }
};
