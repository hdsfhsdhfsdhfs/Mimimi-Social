"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";

type Message = { id:string; conversation_id:string; sender_id:string; content:string; created_at:string };
type Person = { display_name:string|null; username:string|null; avatar_url:string|null };

export default function ChatPage() {
  const router = useRouter();
  const [userId,setUserId] = useState("");
  const [otherId,setOtherId] = useState("");
  const [person,setPerson] = useState<Person|null>(null);
  const [conversationId,setConversationId] = useState("");
  const [messages,setMessages] = useState<Message[]>([]);
  const [draft,setDraft] = useState("");
  const [loading,setLoading] = useState(true);
  const [sending,setSending] = useState(false);
  const [notice,setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function start() {
      const supabase = getSupabase();
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      const target = new URLSearchParams(window.location.search).get("u") || "";
      if (!target || target === user.id) { setNotice("Não foi possível iniciar esta conversa."); setLoading(false); return; }
      setUserId(user.id); setOtherId(target);
      const [{data:profile,error:profileError},{data:conversation,error:conversationError}] = await Promise.all([
        supabase.from("profiles").select("display_name,username,avatar_url").eq("auth_user_id",target).maybeSingle(),
        supabase.rpc("get_or_create_direct_conversation",{other_user_id:target})
      ]);
      if (!active) return;
      if (profileError || !profile) { setNotice("Este perfil não foi encontrado."); setLoading(false); return; }
      if (conversationError || !conversation) { setNotice(conversationError?.message || "Não foi possível abrir a conversa. Confira a configuração do chat."); setLoading(false); return; }
      setPerson(profile as Person); setConversationId(conversation as string);
      const {data,error} = await supabase.from("direct_messages").select("id,conversation_id,sender_id,content,created_at").eq("conversation_id",conversation).order("created_at",{ascending:true}).limit(200);
      if (error) setNotice("Não foi possível carregar as mensagens: "+error.message);
      else setMessages((data||[]) as Message[]);
      setLoading(false);
    }
    void start();
    return () => { active=false; };
  },[router]);

  async function sendMessage() {
    if (!draft.trim() || !conversationId || sending) return;
    setSending(true); setNotice("");
    const content = draft.trim();
    const {data,error} = await getSupabase().from("direct_messages").insert({conversation_id:conversationId,sender_id:userId,content}).select("id,conversation_id,sender_id,content,created_at").single();
    if (error) setNotice("Não foi possível enviar: "+error.message);
    else { setMessages(old=>[...old,data as Message]); setDraft(""); }
    setSending(false);
  }

  return <main className="mimimi-chat-page">
    <header className="mimimi-chat-header"><button onClick={()=>router.back()} aria-label="Voltar"><ArrowLeft size={20}/></button><span className="mimimi-chat-avatar">{person?.avatar_url?<img src={person.avatar_url} alt=""/>:(person?.display_name||"M").charAt(0)}</span><span><strong>{person?.display_name||"Conversa privada"}</strong><small>@{person?.username||"membro"}</small></span></header>
    <section className="mimimi-chat-messages">
      {loading?<p className="mimimi-chat-empty">Preparando sua conversa... 💗</p>:messages.length===0?<div className="mimimi-chat-empty"><MessageCircle size={30}/><strong>Seu cantinho de conversa</strong><span>Envie um oi para começar! 🐰</span></div>:messages.map(message=><div key={message.id} className={message.sender_id===userId?"mimimi-chat-bubble mine":"mimimi-chat-bubble"}><p>{message.content}</p><small>{new Date(message.created_at).toLocaleString("pt-BR",{hour:"2-digit",minute:"2-digit",day:"2-digit",month:"short"})}</small></div>)}
    </section>
    {notice&&<p className="mimimi-chat-notice">{notice}</p>}
    <form className="mimimi-chat-compose" onSubmit={e=>{e.preventDefault();void sendMessage();}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Escreva uma mensagem..." maxLength={5000} disabled={!conversationId}/><button type="submit" disabled={!draft.trim()||sending||!conversationId} aria-label="Enviar mensagem"><Send size={18}/></button></form>
  </main>;
}
