"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, Heart, MessageCircle, Pin, Trash2, Lock, Unlock, Send } from "lucide-react";

type Post = {
  id:string; author_id:string; post_type:"simple"|"advanced"; title:string|null; content:string;
  cover_url:string|null; media_url:string|null; media_type:string|null; audio_url:string|null;
  background_color:string|null; background_image_url:string|null; comments_enabled:boolean; created_at:string;
};
type Person = { display_name:string|null; username:string|null; avatar_url:string|null; role_label:string|null; is_official:boolean };
type Comment = { id:string; post_id:string; author_id:string; content:string; is_pinned:boolean; created_at:string; author_name:string; author_username:string; author_avatar:string|null };
type Reply = { id:string; comment_id:string; author_id:string; content:string; created_at:string; author_name:string; author_username:string; author_avatar:string|null };

export default function PostDetailPage() {
  const params=useParams<{id:string}>();
  const router=useRouter();
  const postId=params.id;
  const [post,setPost]=useState<Post|null>(null);
  const [person,setPerson]=useState<Person|null>(null);
  const [userId,setUserId]=useState("");
  const [comments,setComments]=useState<Comment[]>([]);
  const [replies,setReplies]=useState<Reply[]>([]);
  const [replyTexts,setReplyTexts]=useState<Record<string,string>>({});
  const [replyOpen,setReplyOpen]=useState("");
  const [liked,setLiked]=useState(false);
  const [likes,setLikes]=useState(0);
  const [commentText,setCommentText]=useState("");
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState(false);
  const [notice,setNotice]=useState("");

  useEffect(()=>{ void load(); },[postId]);

  async function load(){
    const supabase=getSupabase();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/");return;}
    setUserId(user.id);
    const {data:p,error}=await supabase.from("social_posts").select("*").eq("id",postId).eq("is_draft",false).single();
    if(error||!p){setNotice("Esta publicação não foi encontrada.");setLoading(false);return;}
    setPost(p as Post);
    const [{data:profile},{data:likeRows},{data:myLike},{data:commentRows}]=await Promise.all([
      supabase.from("profiles").select("display_name,username,avatar_url,role_label,is_official").eq("auth_user_id",p.author_id).maybeSingle(),
      supabase.from("social_post_likes").select("user_id").eq("post_id",postId),
      supabase.from("social_post_likes").select("id").eq("post_id",postId).eq("user_id",user.id).maybeSingle(),
      supabase.from("social_post_comments").select("id,post_id,author_id,content,is_pinned,created_at").eq("post_id",postId).order("created_at",{ascending:true})
    ]);
    setPerson(profile as Person|null);
    setLikes(likeRows?.length||0);
    setLiked(!!myLike);
    const {data:replyRows}=await supabase.from("social_post_comment_replies").select("id,comment_id,author_id,content,created_at").in("comment_id",(commentRows||[]).map((c:any)=>c.id)).order("created_at",{ascending:true});
    const ids=[...new Set([...(commentRows||[]).map((c:any)=>c.author_id),...(replyRows||[]).map((r:any)=>r.author_id)])];
    const {data:people}=ids.length?await supabase.from("profiles").select("auth_user_id,display_name,username,avatar_url").in("auth_user_id",ids):{data:[] as any[]};
    const byId=new Map((people||[]).map((x:any)=>[x.auth_user_id,x]));
    setComments((commentRows||[]).map((c:any)=>{const a:any=byId.get(c.author_id);return {...c,author_name:a?.display_name||"Pessoa Mimimi",author_username:a?.username||"membro",author_avatar:a?.avatar_url||null};}));
    setReplies((replyRows||[]).map((r:any)=>{const a:any=byId.get(r.author_id);return {...r,author_name:a?.display_name||"Pessoa Mimimi",author_username:a?.username||"membro",author_avatar:a?.avatar_url||null};}));
    setLoading(false);
  }

  async function toggleLike(){
    if(!post||busy)return;
    setBusy(true);
    const supabase=getSupabase();
    if(liked){
      const {error}=await supabase.from("social_post_likes").delete().eq("post_id",post.id).eq("user_id",userId);
      if(error)setNotice("Erro ao remover curtida: "+error.message);
      else {setLiked(false);setLikes(n=>Math.max(0,n-1));}
    }else{
      const {error}=await supabase.from("social_post_likes").insert({post_id:post.id,user_id:userId});
      if(error)setNotice("Erro ao curtir: "+error.message);
      else {setLiked(true);setLikes(n=>n+1);}
    }
    setBusy(false);
  }

  async function sendComment(){
    if(!post||!commentText.trim()||busy||!post.comments_enabled)return;
    setBusy(true);
    const {data,error}=await getSupabase().from("social_post_comments").insert({post_id:post.id,author_id:userId,content:commentText.trim()}).select("id,post_id,author_id,content,is_pinned,created_at").single();
    if(error)setNotice("Erro ao comentar: "+error.message);
    else{
      const {data:profile}=await getSupabase().from("profiles").select("display_name,username,avatar_url").eq("auth_user_id",userId).maybeSingle();
      setComments(old=>[...old,{...data,author_name:profile?.display_name||"Você",author_username:profile?.username||"membro",author_avatar:profile?.avatar_url||null}]);
      setCommentText("");
    }
    setBusy(false);
  }

  async function sendReply(commentId:string){
    const content=(replyTexts[commentId]||"").trim();
    if(!content||busy||!post?.comments_enabled)return;
    setBusy(true);
    const {data,error}=await getSupabase().from("social_post_comment_replies").insert({comment_id:commentId,author_id:userId,content}).select("id,comment_id,author_id,content,created_at").single();
    if(error)setNotice("Não foi possível enviar sua resposta: "+error.message);
    else{
      const {data:profile}=await getSupabase().from("profiles").select("display_name,username,avatar_url").eq("auth_user_id",userId).maybeSingle();
      setReplies(old=>[...old,{...data,author_name:profile?.display_name||"Você",author_username:profile?.username||"membro",author_avatar:profile?.avatar_url||null}]);
      setReplyTexts(old=>({...old,[commentId]:""}));
      setReplyOpen("");
    }
    setBusy(false);
  }

  async function deleteReply(id:string){
    const {error}=await getSupabase().from("social_post_comment_replies").delete().eq("id",id);
    if(error)setNotice("Não foi possível excluir a resposta.");
    else setReplies(old=>old.filter(r=>r.id!==id));
  }

  async function toggleComments(){
    if(!post||post.author_id!==userId)return;
    const next=!post.comments_enabled;
    const {error}=await getSupabase().from("social_posts").update({comments_enabled:next}).eq("id",post.id).eq("author_id",userId);
    if(error)setNotice("Não foi possível atualizar os comentários.");
    else setPost({...post,comments_enabled:next});
  }

  async function pinComment(id:string){
    if(!post||post.author_id!==userId)return;
    const supabase=getSupabase();
    const current=comments.find(c=>c.id===id);
    if(!current)return;
    if(current.is_pinned){
      const {error}=await supabase.from("social_post_comments").update({is_pinned:false}).eq("id",id);
      if(error){setNotice("Não foi possível desafixar o comentário.");return;}
      setComments(old=>old.map(c=>({...c,is_pinned:false})));
    }else{
      const {error:clearError}=await supabase.from("social_post_comments").update({is_pinned:false}).eq("post_id",post.id);
      if(clearError){setNotice("Não foi possível fixar o comentário.");return;}
      const {error}=await supabase.from("social_post_comments").update({is_pinned:true}).eq("id",id);
      if(error){setNotice("Não foi possível fixar o comentário.");return;}
      setComments(old=>old.map(c=>({...c,is_pinned:c.id===id})));
    }
  }

  async function deleteComment(id:string){
    const {error}=await getSupabase().from("social_post_comments").delete().eq("id",id);
    if(error)setNotice("Não foi possível excluir o comentário.");
    else {setComments(old=>old.filter(c=>c.id!==id));setReplies(old=>old.filter(r=>r.comment_id!==id));}
  }

  async function deletePost(){
    if(!post||post.author_id!==userId)return;
    if(!window.confirm("Tem certeza que deseja apagar esta publicação? Essa ação não pode ser desfeita."))return;
    setBusy(true);
    const {error}=await getSupabase().from("social_posts").delete().eq("id",post.id).eq("author_id",userId);
    setBusy(false);
    if(error){setNotice("Não foi possível apagar a publicação.");return;}
    router.push("/perfil");
  }

  if(loading)return <main className="post-detail-page"><p className="post-detail-loading">Abrindo publicação... 💗</p></main>;
  if(!post)return <main className="post-detail-page"><button className="post-back" onClick={()=>router.back()}><ArrowLeft size={18}/> Voltar</button><p className="post-detail-loading">{notice||"Publicação não encontrada."}</p></main>;

  const owner=post.author_id===userId;
  const authorName=person?.display_name||"Pessoa Mimimi";
  const authorHandle="@"+(person?.username||"membro");
  return <main className="post-detail-page">
    <header className="post-detail-top"><button className="post-back" onClick={()=>router.back()}><ArrowLeft size={18}/> Voltar</button><strong>Publicação</strong>{owner&&<button className="post-delete-button" onClick={()=>void deletePost()} disabled={busy}><Trash2 size={15}/> Apagar post</button>}</header>
    <article className="post-detail-card" style={{backgroundColor:post.background_color||"#fff",backgroundImage:post.background_image_url?`linear-gradient(#0002,#0002),url("${post.background_image_url}")`:undefined,backgroundSize:"cover",backgroundPosition:"center"}}>
      <button className="post-detail-author" onClick={()=>router.push("/perfil?id="+encodeURIComponent(post.author_id))}>
        <span className="post-detail-avatar">{person?.avatar_url?<img src={person.avatar_url} alt=""/>:authorName.charAt(0)}</span>
        <span><strong>{authorName}</strong><small>{authorHandle} · {new Date(post.created_at).toLocaleString("pt-BR")}</small><span className="social-post-author-badges">{person?.role_label&&<b className="social-role-badge">{person.role_label}</b>}{person?.is_official&&<b className="social-verified-badge">✓ Verificado</b>}</span></span>
      </button>
      {post.cover_url&&<img className="post-detail-cover" src={post.cover_url} alt="Capa da publicação"/>}
      {post.title&&<h1>{post.title}</h1>}
      {post.content&&<p className="post-detail-content">{post.content}</p>}
      {post.media_url&&(post.media_type?.startsWith("video/")?<video className="post-detail-media" src={post.media_url} controls/>:<img className="post-detail-media" src={post.media_url} alt="Mídia da publicação"/>)}
      {post.audio_url&&<audio className="post-detail-audio" src={post.audio_url} controls/>}
      <div className="post-detail-actions"><button className={liked?"liked":""} onClick={()=>void toggleLike()} disabled={busy}><Heart size={19} fill={liked?"currentColor":"none"}/> {likes} Curtidas</button><span><MessageCircle size={18}/> {comments.length} Comentários</span></div>
      {owner&&<div className="post-comment-settings"><span><strong>Comentários</strong><small>{post.comments_enabled?"As pessoas podem comentar nesta publicação.":"Os comentários estão desativados."}</small></span><button onClick={()=>void toggleComments()}>{post.comments_enabled?<><Lock size={15}/> Desativar</>:<><Unlock size={15}/> Ativar</>}</button></div>}
    </article>
    <section className="post-comments-panel">
      <div className="post-comments-heading"><h2>Comentários</h2><span>{comments.length}</span></div>
      {post.comments_enabled?<div className="post-comment-compose"><textarea value={commentText} onChange={e=>setCommentText(e.target.value)} placeholder="Escreva um comentário com carinho... 🐰" maxLength={2000}/><button onClick={()=>void sendComment()} disabled={!commentText.trim()||busy}><Send size={16}/> Enviar</button></div>:<p className="post-comments-closed">O autor desativou os comentários desta publicação.</p>}
      <div className="post-comments-list">{[...comments].sort((a,b)=>Number(b.is_pinned)-Number(a.is_pinned)).map(comment=><article className={comment.is_pinned?"post-comment pinned":"post-comment"} key={comment.id}>
        {comment.is_pinned&&<small className="post-comment-pinned"><Pin size={12}/> Comentário fixado</small>}
        <div className="post-comment-author"><span className="post-comment-avatar">{comment.author_avatar?<img src={comment.author_avatar} alt=""/>:comment.author_name.charAt(0)}</span><span><strong>{comment.author_name}</strong><small>@{comment.author_username} · {new Date(comment.created_at).toLocaleString("pt-BR")}</small></span></div>
        <p>{comment.content}</p>
        <div className="post-comment-tools"><button onClick={()=>setReplyOpen(replyOpen===comment.id?"":comment.id)}><MessageCircle size={13}/> Responder ({replies.filter(r=>r.comment_id===comment.id).length})</button>{owner&&<button onClick={()=>void pinComment(comment.id)}><Pin size={13}/> {comment.is_pinned?"Desafixar":"Fixar"}</button>}{(owner||comment.author_id===userId)&&<button onClick={()=>void deleteComment(comment.id)}><Trash2 size={13}/> Excluir</button>}</div>
        <div className="post-replies-list">{replies.filter(r=>r.comment_id===comment.id).map(reply=><div className="post-reply" key={reply.id}><div className="post-comment-author"><span className="post-comment-avatar">{reply.author_avatar?<img src={reply.author_avatar} alt=""/>:reply.author_name.charAt(0)}</span><span><strong>{reply.author_name}</strong><small>@{reply.author_username} · {new Date(reply.created_at).toLocaleString("pt-BR")}</small></span></div><p>{reply.content}</p>{(owner||reply.author_id===userId)&&<div className="post-comment-tools"><button onClick={()=>void deleteReply(reply.id)}><Trash2 size={13}/> Excluir resposta</button></div>}</div>)}</div>
        {replyOpen===comment.id&&post.comments_enabled&&<div className="post-reply-compose"><textarea value={replyTexts[comment.id]||""} onChange={e=>setReplyTexts(old=>({...old,[comment.id]:e.target.value}))} placeholder="Escreva sua resposta... 💗" maxLength={2000}/><button onClick={()=>void sendReply(comment.id)} disabled={!(replyTexts[comment.id]||"").trim()||busy}><Send size={14}/> Responder</button></div>}
      </article>)}
      {comments.length===0&&<p className="post-comments-empty">Ainda não tem comentários. Que tal começar essa conversa? 💗</p>}</div>
    </section>
    {notice&&<div className="post-detail-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  </main>;
}
