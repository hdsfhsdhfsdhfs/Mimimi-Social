"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, ImagePlus, Music2, Video, Trash2, FileText, CheckCircle2 } from "lucide-react";

type PostDraft = { id:string; post_type:"simple"|"advanced"; title:string|null; content:string; cover_url:string|null; media_url:string|null; media_type:string|null; audio_url:string|null; background_color:string; background_image_url:string|null; updated_at:string };

export default function PublishPage() {
  const router = useRouter();
  const [view,setView] = useState<"choose"|"editor"|"drafts">("choose");
  const [postType,setPostType] = useState<"simple"|"advanced">("simple");
  const [draftId,setDraftId] = useState("");
  const [drafts,setDrafts] = useState<PostDraft[]>([]);
  const [title,setTitle] = useState("");
  const [content,setContent] = useState("");
  const [backgroundColor,setBackgroundColor] = useState("#FFFFFF");
  const [cover,setCover] = useState<File|null>(null);
  const [media,setMedia] = useState<File|null>(null);
  const [audio,setAudio] = useState<File|null>(null);
  const [background,setBackground] = useState<File|null>(null);
  const [coverPreview,setCoverPreview] = useState("");
  const [mediaPreview,setMediaPreview] = useState("");
  const [backgroundPreview,setBackgroundPreview] = useState("");
  const [existing,setExisting] = useState<Partial<PostDraft>>({});
  const [busy,setBusy] = useState(false);
  const [notice,setNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("rascunhos")==="1") { setView("drafts"); void loadDrafts(); }
    const id = params.get("id");
    if (id) void openDraft(id);
  }, []);

  async function loadDrafts() {
    const supabase=getSupabase();
    const {data:{user}}=await supabase.auth.getUser();
    if(!user){router.replace("/");return;}
    const {data,error}=await supabase.from("social_posts").select("*").eq("author_id",user.id).eq("is_draft",true).order("updated_at",{ascending:false});
    if(error){setNotice("Não foi possível carregar seus rascunhos.");return;}
    setDrafts((data||[]) as PostDraft[]);
  }

  function clearEditor() {
    setDraftId("");setTitle("");setContent("");setBackgroundColor("#FFFFFF");
    setCover(null);setMedia(null);setAudio(null);setBackground(null);
    setCoverPreview("");setMediaPreview("");setBackgroundPreview("");setExisting({});
  }

  async function openDraft(id:string) {
    const {data:{user}}=await getSupabase().auth.getUser();
    if(!user){router.replace("/");return;}
    const {data,error}=await getSupabase().from("social_posts").select("*").eq("id",id).eq("author_id",user.id).eq("is_draft",true).single();
    if(error||!data){setNotice("Esse rascunho não foi encontrado.");setView("drafts");return;}
    const d=data as PostDraft;
    setDraftId(d.id);setPostType(d.post_type);setTitle(d.title||"");setContent(d.content||"");
    setBackgroundColor(d.background_color||"#FFFFFF");setExisting(d);
    setCoverPreview(d.cover_url||"");setMediaPreview(d.media_url||"");setBackgroundPreview(d.background_image_url||"");
    setView("editor");
  }

  async function upload(file:File,kind:string,userId:string) {
    const ext=file.name.split(".").pop()?.toLowerCase()||"bin";
    const path=userId+"/"+kind+"-"+Date.now()+"."+ext;
    const {error}=await getSupabase().storage.from("post-assets").upload(path,file,{contentType:file.type,upsert:false});
    if(error) throw error;
    return getSupabase().storage.from("post-assets").getPublicUrl(path).data.publicUrl;
  }

  async function save(publishNow:boolean) {
    if(busy)return;
    if(!content.trim()&&!media&&!existing.media_url){setNotice("Escreva algo ou adicione uma foto/vídeo.");return;}
    if(postType==="advanced"&&!title.trim()){setNotice("Adicione um título para sua publicação avançada.");return;}
    setBusy(true);setNotice("");
    try {
      const supabase=getSupabase();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){router.replace("/");return;}
      let coverUrl=existing.cover_url||null,mediaUrl=existing.media_url||null,audioUrl=existing.audio_url||null,bgUrl=existing.background_image_url||null;
      if(cover)coverUrl=await upload(cover,"cover",user.id);
      if(media)mediaUrl=await upload(media,"media",user.id);
      if(audio)audioUrl=await upload(audio,"audio",user.id);
      if(background)bgUrl=await upload(background,"background",user.id);
      const values={author_id:user.id,post_type:postType,title:postType==="advanced"?title.trim():null,content:content.trim(),cover_url:coverUrl,media_url:mediaUrl,media_type:media?.type||existing.media_type||null,audio_url:audioUrl,background_color:backgroundColor,background_image_url:bgUrl,is_draft:!publishNow,updated_at:new Date().toISOString()};
      let result;
      if(draftId) result=await supabase.from("social_posts").update(values).eq("id",draftId).eq("author_id",user.id).select("id").single();
      else result=await supabase.from("social_posts").insert(values).select("id").single();
      if(result.error)throw result.error;
      if(publishNow){setNotice("Publicado no Feed para você! 💗");router.push("/");}
      else {setNotice("Rascunho salvo com carinho! ♡");setDraftId(result.data.id);setExisting({...values,id:result.data.id});}
    } catch(e:any){setNotice(e?.message||"Não foi possível salvar. Tente novamente.");}
    finally{setBusy(false);}
  }

  async function deleteDraft(id:string) {
    const {error}=await getSupabase().from("social_posts").delete().eq("id",id);
    if(error){setNotice("Não foi possível excluir o rascunho.");return;}
    setDrafts(items=>items.filter(item=>item.id!==id));
  }

  const fileInput=(label:string,accept:string,onChange:(f:File|null)=>void,icon:any)=><label className="publish-file"><input type="file" accept={accept} onChange={e=>onChange(e.target.files?.[0]||null)}/>{icon}<span>{label}</span></label>;

  if(view==="choose")return <main className="publish-page"><header className="publish-header"><button onClick={()=>router.push("/")}><ArrowLeft/></button><strong>Nova publicação</strong><button onClick={()=>{setView("drafts");void loadDrafts();}}>Rascunhos</button></header><section className="publish-choice"><span className="publish-eyebrow">SEU MUNDO, SUAS HISTÓRIAS</span><h1>Como você quer postar?</h1><p>Escolha o formato que combina com o que você quer compartilhar.</p><button onClick={()=>{clearEditor();setPostType("simple");setView("editor");}}><span>✧</span><div><strong>Publicação simples</strong><small>Texto, fotos, vídeos, áudio e fundos personalizados.</small></div><b>›</b></button><button onClick={()=>{clearEditor();setPostType("advanced");setView("editor");}}><span>▣</span><div><strong>Publicação avançada</strong><small>Capa, título e conteúdo em uma publicação especial.</small></div><b>›</b></button></section></main>;

  if(view==="drafts")return <main className="publish-page"><header className="publish-header"><button onClick={()=>setView("choose")}><ArrowLeft/></button><strong>Meus rascunhos</strong><button onClick={()=>setView("choose")}>＋ Novo</button></header><section className="publish-drafts"><h1>Guardadinhos para depois ♡</h1><p>Edite quando quiser ou exclua o que não vai mais usar.</p>{drafts.length===0?<div className="publish-empty"><FileText size={32}/><strong>Nenhum rascunho por aqui</strong><span>Suas publicações salvas aparecerão aqui.</span></div>:drafts.map(d=><article key={d.id} className="publish-draft-card"><div><span>{d.post_type==="advanced"?"PUBLICAÇÃO AVANÇADA":"PUBLICAÇÃO SIMPLES"}</span><strong>{d.title||d.content||"Publicação sem texto"}</strong><small>Salvo em {new Date(d.updated_at).toLocaleDateString("pt-BR")}</small></div><button onClick={()=>void openDraft(d.id)}>Editar</button><button className="publish-delete" onClick={()=>void deleteDraft(d.id)} aria-label="Excluir rascunho"><Trash2 size={17}/></button></article>)}</section></main>;

  return <main className="publish-page"><header className="publish-header"><button onClick={()=>setView("choose")}><ArrowLeft/></button><strong>{draftId?"Editar rascunho":postType==="simple"?"Publicação simples":"Publicação avançada"}</strong><button onClick={()=>void save(false)}>Salvar rascunho</button></header><section className="publish-editor">
    <div className="publish-editor-top"><span className="publish-eyebrow">{postType==="simple"?"UM RECADO DO SEU JEITO":"UMA HISTÓRIA COM MAIS DETALHES"}</span><h1>{postType==="simple"?"Compartilhe seu momento":"Crie sua publicação"}</h1></div>
    {postType==="advanced"&&<><label className="publish-field">Título da publicação<input value={title} onChange={e=>setTitle(e.target.value)} maxLength={100} placeholder="Dê um título para sua história..."/></label>{fileInput(cover?"Capa selecionada ✓":"Adicionar capa do post","image/jpeg,image/png,image/webp,image/gif",setCover,<ImagePlus size={18}/>) }{(coverPreview)&&<img className="publish-cover-preview" src={coverPreview} alt="Capa da publicação"/>}</>}
    <label className="publish-field">Texto da publicação<textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="Escreva o que está pensando..." rows={postType==="advanced"?8:6}/></label>
    <div className="publish-tools">{fileInput(media?media.name:existing.media_url?"Mídia já adicionada":"Adicionar imagem ou vídeo","image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm",setMedia,<Video size={18}/>)}{fileInput(audio?"Áudio selecionado ✓":existing.audio_url?"Áudio já adicionado":"Incluir áudio","audio/*",setAudio,<Music2 size={18}/>)}{fileInput(background?"Fundo selecionado ✓":"Imagem de fundo","image/jpeg,image/png,image/webp,image/gif",setBackground,<ImagePlus size={18}/>)}</div>
    {mediaPreview&&<div className="publish-media-preview">{existing.media_type?.startsWith("video/")&&!media?<video src={mediaPreview} controls/>:<img src={mediaPreview} alt="Mídia da publicação"/>}</div>}
    {backgroundPreview&&<div className="publish-bg-preview" style={{backgroundImage:"url("+backgroundPreview+")"}}>Prévia do fundo personalizado</div>}
    <label className="publish-field">Cor de fundo <div className="publish-colors">{["#FFFFFF","#FFE3ED","#FFF0E2","#E9E0FF","#DFF5EC","#211923"].map(color=><button key={color} type="button" aria-label={"Cor "+color} className={backgroundColor===color?"selected":""} style={{background:color}} onClick={()=>setBackgroundColor(color)}/>)}</div></label>
    <div className="publish-actions"><button className="publish-save" disabled={busy} onClick={()=>void save(false)}>Salvar rascunho</button><button className="publish-done" disabled={busy} onClick={()=>void save(true)}><CheckCircle2 size={17}/>{busy?"Salvando...":"Concluído"}</button></div>
    {notice&&<p className="publish-notice">{notice}</p>}
  </section></main>;
}
