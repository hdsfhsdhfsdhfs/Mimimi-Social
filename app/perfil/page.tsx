"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, Edit3, MessageCircle, MoreHorizontal, Save, Users, Eye, UserPlus, UserCheck, X, Lock, Send, Trash2 } from "lucide-react";

type Profile = {
  id: number; auth_user_id: string; username: string | null; display_name: string | null;
  bio: string; avatar_url: string | null; background_url: string | null;
  is_official: boolean; role_label: string | null; role_description: string | null;
  created_at: string; username_changed_at?: string | null; hide_profile_visitors?: boolean; mural_is_private?: boolean;
};
type PublishedPost = { id:string; post_type:"simple"|"advanced"; title:string|null; content:string; cover_url:string|null; media_url:string|null; media_type:string|null; audio_url:string|null; background_color:string|null; background_image_url:string|null; created_at:string };
type MuralReply = {id:string; entry_id:string; author_id:string; content:string; created_at:string; author?:Person};
type MuralEntry = { id:string; profile_id:string; author_id:string; content:string; media_url:string|null; media_type:string|null; is_pinned:boolean; created_at:string; author?:Person; replies?:MuralReply[] };
type Person = { auth_user_id: string; display_name: string | null; username: string | null; avatar_url: string | null; viewed_at?: string };
type SocialStats = { followers_count: number; following_count: number; views_count: number; is_following: boolean; viewers: Person[]; viewers_hidden: boolean };

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [backgroundPreview, setBackgroundPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState("Publicações");
  const [showRoleInfo, setShowRoleInfo] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"main"|"account">("main");
  const [signingOut, setSigningOut] = useState(false);
  const [stats, setStats] = useState<SocialStats>({followers_count:0,following_count:0,views_count:0,is_following:false,viewers:[],viewers_hidden:false});
  const [socialList, setSocialList] = useState<Person[]>([]);
  const [listTitle, setListTitle] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [hideVisitors, setHideVisitors] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  const [muralEntries, setMuralEntries] = useState<MuralEntry[]>([]);
  const [muralReplyTexts,setMuralReplyTexts]=useState<Record<string,string>>({});
  const [muralReplyOpen,setMuralReplyOpen]=useState("");
  const [muralPrivate, setMuralPrivate] = useState(false);
  const [muralText, setMuralText] = useState("");
  const [muralFile, setMuralFile] = useState<File | null>(null);
  const [muralPreview, setMuralPreview] = useState("");
  const [muralBusy, setMuralBusy] = useState(false);
  const [publishedPosts, setPublishedPosts] = useState<PublishedPost[]>([]);
  const isOwner = !!profile && profile.auth_user_id === currentUserId;

  async function loadSocial(targetId: string) {
    const supabase = getSupabase();
    await supabase.rpc("record_profile_view", { target_profile_id: targetId });
    const { data, error } = await supabase.rpc("get_profile_social_stats", { target_profile_id: targetId });
    if (!error && data) {
      const next = data as SocialStats;
      setStats({...next, viewers: next.viewers || []});
      setHideVisitors(!!(profile?.hide_profile_visitors));
    }
  }

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      if (!active) return;
      setCurrentUserId(user.id);
      const params = new URLSearchParams(window.location.search);
      const requestedUsername = params.get("u");
      const requestedId = params.get("id");
      let query = supabase.from("profiles").select("id, auth_user_id, username, display_name, bio, avatar_url, background_url, is_official, role_label, role_description, created_at, username_changed_at, hide_profile_visitors, mural_is_private");
      if (requestedUsername) query = query.eq("username", requestedUsername.replace(/^@/, "").toLowerCase());
      else if (requestedId) query = query.eq("auth_user_id", requestedId);
      else query = query.eq("auth_user_id", user.id);
      const { data, error } = await query.maybeSingle();
      if (!active) return;
      if (error || !data) {
        setMessage(error ? "Não foi possível carregar este perfil." : "Este perfil ainda não existe.");
        setLoading(false);
        return;
      }
      const current = data as Profile;
      setProfile(current);
      setDisplayName(current.display_name || "");
      setUsername(current.username || "");
      setBio(current.bio || "");
      setHideVisitors(!!current.hide_profile_visitors);
      setMuralPrivate(!!(current as any).mural_is_private);
      await loadMural(current.auth_user_id);
      await loadPublishedPosts(current.auth_user_id);
      await supabase.rpc("record_profile_view", { target_profile_id: current.auth_user_id });
      const { data: social } = await supabase.rpc("get_profile_social_stats", { target_profile_id: current.auth_user_id });
      if (active && social) setStats({...social as SocialStats, viewers: (social as SocialStats).viewers || []});
      if (active) setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [router]);

  async function loadMural(profileId: string) {
    const supabase = getSupabase();
    const {data} = await supabase.from("profile_mural_entries").select("id,profile_id,author_id,content,media_url,media_type,is_pinned,created_at").eq("profile_id",profileId).order("is_pinned",{ascending:false}).order("created_at",{ascending:false});
    if (!data?.length) { setMuralEntries([]); return; }
    const {data:replyRows} = await supabase.from("profile_mural_replies").select("id,entry_id,author_id,content,created_at").in("entry_id",data.map((entry:any)=>entry.id)).order("created_at",{ascending:true});
    const authorIds = [...new Set([...data.map((entry:any)=>entry.author_id),...(replyRows||[]).map((reply:any)=>reply.author_id)])];
    const {data:authors} = await supabase.from("profiles").select("auth_user_id,display_name,username,avatar_url").in("auth_user_id",authorIds);
    const byId = new Map((authors||[]).map((person:any)=>[person.auth_user_id,person]));
    setMuralEntries(data.map((entry:any)=>({...entry,author:byId.get(entry.author_id),replies:(replyRows||[]).filter((reply:any)=>reply.entry_id===entry.id).map((reply:any)=>({...reply,author:byId.get(reply.author_id)}))})) as MuralEntry[]);
  }

  async function loadPublishedPosts(authorId: string) {
    const {data,error} = await getSupabase().from("social_posts").select("id,post_type,title,content,cover_url,media_url,media_type,audio_url,background_color,background_image_url,created_at").eq("author_id",authorId).eq("is_draft",false).order("created_at",{ascending:false});
    if (!error) setPublishedPosts((data||[]) as PublishedPost[]);
  }

  function chooseMuralFile(file?: File) {
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp","image/gif"].includes(file.type)) { setMessage("Escolha uma imagem JPG, PNG, WEBP ou GIF."); return; }
    if (file.size > 5*1024*1024) { setMessage("A imagem ou GIF deve ter no máximo 5 MB."); return; }
    setMuralFile(file); setMuralPreview(URL.createObjectURL(file)); setMessage("");
  }

  async function publishMuralEntry() {
    if (!profile || !currentUserId || (!muralText.trim() && !muralFile) || muralBusy) return;
    if (muralPrivate && !isOwner) { setMessage("Este mural está privado para novos comentários."); return; }
    setMuralBusy(true); setMessage("");
    try {
      let mediaUrl:string|null = null;
      if (muralFile) {
        const ext = muralFile.type==="image/jpeg"?"jpg":muralFile.type.split("/")[1];
        const path = `${currentUserId}/mural-${Date.now()}.${ext}`;
        const {error:uploadError} = await getSupabase().storage.from("profile-assets").upload(path,muralFile,{contentType:muralFile.type,upsert:false});
        if (uploadError) throw uploadError;
        mediaUrl = getSupabase().storage.from("profile-assets").getPublicUrl(path).data.publicUrl;
      }
      const {error} = await getSupabase().from("profile_mural_entries").insert({profile_id:profile.auth_user_id,author_id:currentUserId,content:muralText.trim(),media_url:mediaUrl,media_type:muralFile?.type||null});
      if (error) throw error;
      setMuralText(""); setMuralFile(null); setMuralPreview("");
      await loadMural(profile.auth_user_id);
      setMessage("Recadinho publicado no mural! 💗");
    } catch (error:any) { setMessage(error?.message||"Não foi possível publicar. Tente novamente."); }
    setMuralBusy(false);
  }

  async function sendMuralReply(entry:MuralEntry) {
    const content=(muralReplyTexts[entry.id]||"").trim();
    if(!content||muralBusy||!profile||(muralPrivate&&!isOwner)) return;
    setMuralBusy(true); setMessage("");
    const {error}=await getSupabase().from("profile_mural_replies").insert({entry_id:entry.id,author_id:currentUserId,content});
    if(error) setMessage("Não foi possível enviar sua resposta: "+error.message);
    else {setMuralReplyTexts(old=>({...old,[entry.id]:""}));setMuralReplyOpen("");await loadMural(profile.auth_user_id);}
    setMuralBusy(false);
  }

  async function deleteMuralReply(reply:MuralReply) {
    const {error}=await getSupabase().from("profile_mural_replies").delete().eq("id",reply.id);
    if(error) setMessage("Não foi possível apagar esta resposta.");
    else if(profile) await loadMural(profile.auth_user_id);
  }

  async function toggleMuralPrivacy(next:boolean) {
    if (!profile || !isOwner) return;
    const {error} = await getSupabase().from("profiles").update({mural_is_private:next}).eq("auth_user_id",currentUserId);
    if (error) setMessage("Não foi possível alterar a privacidade do mural.");
    else { setMuralPrivate(next); setProfile(p=>p?{...p,mural_is_private:next} as Profile:p); setMessage(next?"Mural privado: todos continuam vendo, mas só você pode receber novos comentários. 🔒":"Mural público: todos podem comentar! 💗"); }
  }

  async function manageMuralEntry(entry:MuralEntry, action:"pin"|"delete") {
    if (!profile || !isOwner) return;
    if (action==="delete") {
      const {error} = await getSupabase().from("profile_mural_entries").delete().eq("id",entry.id);
      if (error) setMessage("Não foi possível apagar este recado.");
    } else {
      const {error} = await getSupabase().from("profile_mural_entries").update({is_pinned:!entry.is_pinned}).eq("id",entry.id);
      if (error) setMessage("Não foi possível atualizar o recado.");
    }
    await loadMural(profile.auth_user_id);
  }

  function selectProfileImage(file: File | undefined, kind: "avatar" | "background") {
    if (!file) return;
    const maxSize = kind === "avatar" ? 2 : 5;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { setMessage("Use uma imagem JPG, PNG ou WEBP."); return; }
    if (file.size > maxSize * 1024 * 1024) { setMessage(`A imagem deve ter no máximo ${maxSize} MB.`); return; }
    setMessage("");
    const preview = URL.createObjectURL(file);
    if (kind === "avatar") { setAvatarFile(file); setAvatarPreview(preview); }
    else { setBackgroundFile(file); setBackgroundPreview(preview); }
  }

  async function uploadSelectedImage(file: File, kind: "avatar" | "background", userId: string) {
    const supabase = getSupabase();
    const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
    const path = `${userId}/${kind}-${Date.now()}.${extension}`;
    const { error } = await supabase.storage.from("profile-assets").upload(path, file, {contentType:file.type,upsert:false});
    if (error) throw error;
    return supabase.storage.from("profile-assets").getPublicUrl(path).data.publicUrl;
  }

  async function saveProfile() {
    if (!profile) return;
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!cleanName) { setMessage("Escolha um nome para exibir no seu perfil."); return; }
    if (cleanUsername && !/^[a-z0-9._]{3,20}$/.test(cleanUsername)) { setMessage("O @usuário deve ter de 3 a 20 caracteres: letras, números, ponto ou underline."); return; }
    if (cleanUsername !== (profile.username || "") && profile.username_changed_at) { const nextAllowed = new Date(profile.username_changed_at); nextAllowed.setMonth(nextAllowed.getMonth() + 2); if (Date.now() < nextAllowed.getTime()) { setMessage(`Você poderá mudar seu @ novamente em ${nextAllowed.toLocaleDateString("pt-BR")}.`); return; } }
    setSaving(true); setMessage("");
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }
    try {
      let avatarUrl = profile.avatar_url, backgroundUrl = profile.background_url;
      if (avatarFile) avatarUrl = await uploadSelectedImage(avatarFile, "avatar", user.id);
      if (backgroundFile) backgroundUrl = await uploadSelectedImage(backgroundFile, "background", user.id);
      const values = {auth_user_id:user.id,display_name:cleanName,username:cleanUsername||null,bio:bio.trim().slice(0,160),avatar_url:avatarUrl,background_url:backgroundUrl,updated_at:new Date().toISOString()};
      const {data,error} = await supabase.from("profiles").upsert(values,{onConflict:"auth_user_id"}).select("id, auth_user_id, username, display_name, bio, avatar_url, background_url, is_official, role_label, role_description, created_at, username_changed_at, hide_profile_visitors").single();
      if (error) setMessage(error.code==="23505" ? "Esse @usuário já está sendo usado. Escolha outro." : error.message.includes("USERNAME_CHANGE_COOLDOWN") ? "Você só pode mudar seu @ uma vez a cada 2 meses." : `Erro ao salvar: ${error.message}`);
      else { setProfile(data as Profile); setAvatarFile(null); setBackgroundFile(null); setAvatarPreview(""); setBackgroundPreview(""); setEditing(false); setMessage("Seu cantinho foi atualizado! 💗"); }
    } catch { setMessage("Não foi possível enviar uma das imagens. Confira sua conexão e tente novamente."); }
    setSaving(false);
  }

  async function toggleFollow() {
    if (!profile || isOwner || followingBusy) return;
    setFollowingBusy(true); setMessage("");
    const supabase = getSupabase();
    if (stats.is_following) {
      const {error} = await supabase.from("profile_follows").delete().eq("follower_id",currentUserId).eq("following_id",profile.auth_user_id);
      if (error) setMessage("Não foi possível deixar de seguir agora.");
      else setStats(s=>({...s,is_following:false,followers_count:Math.max(0,s.followers_count-1)}));
    } else {
      const {error} = await supabase.from("profile_follows").insert({follower_id:currentUserId,following_id:profile.auth_user_id});
      if (error) setMessage("Não foi possível seguir este perfil agora.");
      else setStats(s=>({...s,is_following:true,followers_count:s.followers_count+1}));
    }
    setFollowingBusy(false);
  }

  async function openPeopleList(kind: "followers" | "following" | "viewers") {
    if (!profile) return;
    setListTitle(kind==="followers" ? "Seguidores" : kind==="following" ? "Seguindo" : "Quem visitou");
    setListOpen(true); setListLoading(true); setSocialList([]);
    if (kind==="viewers") { setSocialList(stats.viewers || []); setListLoading(false); return; }
    const supabase = getSupabase();
    const column = kind==="followers" ? "following_id" : "follower_id";
    const {data,error} = await supabase.from("profile_follows").select("follower_id, following_id").eq(column,profile.auth_user_id);
    if (error || !data?.length) { setListLoading(false); return; }
    const ids = data.map((item:any)=>kind==="followers" ? item.follower_id : item.following_id);
    const {data:people} = await supabase.from("profiles").select("auth_user_id,display_name,username,avatar_url").in("auth_user_id",ids);
    setSocialList((people || []) as Person[]);
    setListLoading(false);
  }

  async function updateVisitorPrivacy(next: boolean) {
    if (!profile || !isOwner) return;
    setPrivacyBusy(true);
    const {error} = await getSupabase().from("profiles").update({hide_profile_visitors:next}).eq("auth_user_id",currentUserId);
    if (error) setMessage("Não foi possível atualizar a privacidade. Tente novamente.");
    else { setHideVisitors(next); setProfile(p=>p?{...p,hide_profile_visitors:next}:p); const {data}=await getSupabase().rpc("get_profile_social_stats",{target_profile_id:profile.auth_user_id}); if(data) setStats({...data as SocialStats,viewers:(data as SocialStats).viewers||[]}); setMessage(next?"A lista de visitantes ficará privada para outras pessoas. 🔒":"A lista de visitantes ficará visível para todos. 💗"); }
    setPrivacyBusy(false);
  }

  if (loading) return <main className="profile-loading">Preparando seu cantinho... 💗</main>;
  if (!profile) return <main className="profile-loading">{message || "Perfil não encontrado."}<button onClick={()=>router.push("/")}>Voltar ao início</button></main>;
  const name = profile.display_name || "Meu perfil";
  const handle = profile.username ? "@"+profile.username : "@defina_seu_usuario";
  const joined = profile.created_at ? new Date(profile.created_at).toLocaleDateString("pt-BR",{day:"numeric",month:"short",year:"numeric"}) : "recentemente";
  const initial = name.trim().charAt(0).toUpperCase() || "M";

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    const { error } = await getSupabase().auth.signOut();
    if (error) { setMessage("Não foi possível sair da conta. Tente novamente."); setSigningOut(false); return; }
    router.replace("/");
    router.refresh();
  }

  if (settingsOpen) return (
    <main className="profile-page profile-settings-page">
      <header className="profile-topbar profile-settings-topbar">
        <button className="profile-settings-back" aria-label="Voltar" onClick={()=>settingsTab==="account"?setSettingsTab("main"):setSettingsOpen(false)}><ArrowLeft size={21}/></button>
        <strong>{settingsTab==="account"?"Conta":"Opções do perfil"}</strong>
        <span/>
      </header>
      <section className="profile-settings-content">
        {settingsTab==="main" ? <>
          <div className="profile-settings-intro"><span><Lock size={22}/></span><h1>Privacidade</h1><p>Gerencie quem pode ver suas visitas e quem pode deixar recadinhos no seu mural.</p></div>
          {isOwner ? <><div className="profile-settings-option"><div><strong>Quem visitou meu perfil</strong><p>{hideVisitors?"Somente você pode ver os nomes e fotos de quem visitou.":"As pessoas podem ver os nomes e fotos de quem visitou."}</p></div><label className="profile-switch"><input type="checkbox" checked={hideVisitors} disabled={privacyBusy} onChange={e=>updateVisitorPrivacy(e.target.checked)}/><span/></label></div><div className="profile-settings-option"><div><strong>Quem pode comentar no meu mural</strong><p>{muralPrivate?"Somente você pode publicar recadinhos. Todos continuam vendo o mural.":"Todas as pessoas podem deixar recadinhos no seu mural."}</p></div><label className="profile-switch"><input type="checkbox" checked={muralPrivate} onChange={e=>toggleMuralPrivacy(e.target.checked)}/><span/></label></div></> : <p className="profile-settings-note">As opções de privacidade só podem ser alteradas pelo dono do perfil.</p>}
          <button className="profile-settings-account-link" onClick={()=>{setSettingsTab("account");setMessage("");}}><span><strong>Conta</strong><small>Login, segurança e acesso à sua conta</small></span><span>›</span></button>
          {message&&<p className="profile-feedback" role="status">{message}</p>}
        </> : <div className="profile-account-panel">
          <div className="profile-settings-intro"><span><Users size={22}/></span><h1>Sua conta</h1><p>Você pode sair desta conta e entrar novamente com ela ou com outra conta.</p></div>
          <button className="profile-signout-button" onClick={signOut} disabled={signingOut}>{signingOut?"Saindo...":"Sair da conta"}</button>
          {message&&<p className="profile-feedback" role="status">{message}</p>}
        </div>}
      </section>
    </main>
  );

  return (
    <main className="profile-page" style={profile.background_url?{backgroundImage:`linear-gradient(180deg,rgba(33,25,35,.35),rgba(33,25,35,.82)),url("${profile.background_url}")`,backgroundSize:"cover",backgroundPosition:"center top",backgroundAttachment:"fixed"}:undefined}>
      <header className="profile-topbar">
        <button className="profile-back" onClick={()=>router.push("/")} aria-label="Voltar ao início"><ArrowLeft size={20}/></button>
        <button className="profile-back" aria-label="Mais opções" onClick={()=>{setSettingsOpen(true);setMessage("");}}><MoreHorizontal size={21}/></button>
      </header>
      <section className="profile-cover" style={(backgroundPreview||profile.background_url)?{backgroundImage:`linear-gradient(145deg,rgba(48,28,55,.55),rgba(33,25,35,.72)),url("${backgroundPreview||profile.background_url}")`,backgroundSize:"cover",backgroundPosition:"center"}:undefined}>
        <div className="profile-cover-glow"/>
        <div className="profile-hero">
          <div className="profile-avatar-wrap">{avatarPreview||profile.avatar_url?<img src={avatarPreview||profile.avatar_url||""} alt="Foto do perfil"/>:<span>{initial}</span>}<i/></div>
          <div className="profile-identity">
            <h1>{name}</h1><p>{handle}</p>
            {(profile.is_official||profile.role_label)&&<div className="profile-role-row">{profile.is_official&&<span className="profile-verified" title="Conta oficial do Mimimi">✓</span>}{profile.role_label&&<button className="profile-role-pill" onClick={()=>setShowRoleInfo(!showRoleInfo)}>{profile.role_label}</button>}</div>}
            {showRoleInfo&&<div className="profile-role-popover">{profile.role_description||"Membro oficial da equipe Mimimi."}</div>}
            <span className="profile-joined">Membro desde {joined}</span>
          </div>
          {isOwner && <button className="profile-edit-button" onClick={()=>{setEditing(!editing);setMessage("");}}><Edit3 size={16}/>{editing?"Fechar edição":"Editar perfil"}</button>}
        </div>
        <div className="profile-stats">
          <button onClick={()=>openPeopleList("followers")}><strong>{stats.followers_count}</strong><span><Users size={14}/> Seguidores</span></button>
          <button onClick={()=>openPeopleList("following")}><strong>{stats.following_count}</strong><span><Users size={14}/> Seguindo</span></button>
          <button onClick={()=>openPeopleList("viewers")}><strong>{stats.views_count}</strong><span><Eye size={14}/> Visitas</span></button>
        </div>
        {!isOwner&&<div className="profile-contact-actions"><button className="profile-follow-button" onClick={toggleFollow} disabled={followingBusy}>{stats.is_following?<><UserCheck size={16}/> Seguindo</>:<><UserPlus size={16}/> Seguir</>}</button><button className="profile-chat-button" onClick={()=>router.push("/chat?u="+encodeURIComponent(profile.auth_user_id))}><MessageCircle size={16}/> Chat</button></div>}
      </section>
      {editing&&isOwner&&<section className="profile-edit-card">
        <div className="profile-edit-heading"><strong>Seu cantinho, suas escolhas</strong><span>Personalize suas informações</span></div>
        <label>Nome de exibição<input value={displayName} maxLength={40} onChange={e=>setDisplayName(e.target.value)} placeholder="Como quer ser chamado?"/></label>
        <label>@Nome de usuário<input value={username} maxLength={20} onChange={e=>setUsername(e.target.value.replace(/^@/,""))} placeholder="seuusuario"/>{profile.username_changed_at&&<small className="profile-username-cooldown">O @ poderá ser alterado novamente em {(()=>{const d=new Date(profile.username_changed_at);d.setMonth(d.getMonth()+2);return d.toLocaleDateString("pt-BR")})()}.</small>}</label>
        <label>Biografia<textarea value={bio} maxLength={160} onChange={e=>setBio(e.target.value)} placeholder="Conte um pouquinho sobre você..."/></label>
        <div className="profile-upload-grid">
          <label className="profile-upload-option"><span>Foto / ícone do perfil</span><small>Quadrada · até 2 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>selectProfileImage(e.target.files?.[0],"avatar")}/><b>{avatarFile?"Imagem selecionada ✓":"Escolher imagem"}</b></label>
          <label className="profile-upload-option"><span>Fundo do perfil</span><small>Vertical · até 5 MB</small><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>selectProfileImage(e.target.files?.[0],"background")}/><b>{backgroundFile?"Fundo selecionado ✓":"Escolher fundo"}</b></label>
        </div>
        <div className="profile-edit-footer"><small>{bio.length}/160</small><button onClick={saveProfile} disabled={saving}><Save size={16}/>{saving?"Salvando...":"Salvar alterações"}</button></div>
      </section>}
      {message&&<p className="profile-feedback" role="status">{message}</p>}
      <div className="profile-tabs">{["Publicações","Mural","Sobre mim"].map(item=><button key={item} className={tab===item?"active":""} onClick={()=>setTab(item)}>{item}</button>)}</div>
      <section className="profile-tab-content">
        {tab==="Publicações"&&<div className="profile-posts-section">{isOwner&&<button className="profile-create-post" onClick={()=>router.push("/publicar")}>＋ Criar publicação</button>}{publishedPosts.length===0?<div className="profile-empty"><span>✧</span><strong>Suas histórias começam aqui</strong><p>Quando você publicar algo, suas publicações aparecerão neste espaço.</p>{isOwner&&<button className="profile-create-post-secondary" onClick={()=>router.push("/publicar")}>＋ Fazer primeira publicação</button>}</div>:<div className="profile-posts-list">{publishedPosts.map(post=><article className="profile-social-post" key={post.id} style={{backgroundColor:post.background_color||"#FFFFFF",backgroundImage:post.background_image_url?`url("${post.background_image_url}")`:undefined,backgroundSize:"cover",backgroundPosition:"center"}}><button className="profile-post-author" onClick={()=>router.push(profile.username?`/perfil?u=${encodeURIComponent(profile.username)}`:"/perfil")}><span className="profile-post-author-avatar">{profile.avatar_url?<img src={profile.avatar_url} alt=""/>:initial}</span><span><strong>{profile.display_name||"Pessoa Mimimi"}</strong><small>@{profile.username||"membro"}</small><span className="social-post-author-badges">{profile.role_label&&<b className="social-role-badge">{profile.role_label}</b>}{profile.is_official&&<b className="social-verified-badge" title="Conta verificada">✓ Verificado</b>}</span></span></button><div className="social-post-open-area" role="button" tabIndex={0} onClick={()=>router.push("/post/"+post.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();router.push("/post/"+post.id);}}}>{post.cover_url&&<img className="profile-social-post-cover" src={post.cover_url} alt="Capa da publicação"/>}{post.title&&<h2>{post.title}</h2>}{post.content&&<p>{post.content}</p>}{post.media_url&&(post.media_type?.startsWith("video/")?<video src={post.media_url} controls onClick={e=>e.stopPropagation()}/>:<img src={post.media_url} alt="Mídia da publicação"/>)}{post.audio_url&&<audio src={post.audio_url} controls onClick={e=>e.stopPropagation()}/>}<small>{new Date(post.created_at).toLocaleDateString("pt-BR")}</small><span className="social-post-read-more">Abrir publicação completa →</span></div></article>)}</div>}</div>}
        {tab==="Mural"&&<div className="profile-mural">
        
        {(!muralPrivate||isOwner)&&<div className="profile-mural-compose"><div className="profile-mural-compose-title"><MessageCircle size={18}/><strong>Deixe um recadinho</strong></div><textarea value={muralText} maxLength={500} onChange={e=>setMuralText(e.target.value)} placeholder="Escreva algo carinhoso..."/>{muralPreview&&<div className="profile-mural-preview">{muralFile?.type==="image/gif"?<img src={muralPreview} alt="Prévia do GIF"/>:<img src={muralPreview} alt="Prévia da imagem"/>}<button onClick={()=>{setMuralFile(null);setMuralPreview("");}}>Remover</button></div>}<div className="profile-mural-compose-footer"><label className="profile-mural-attach">＋ Foto ou GIF<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>chooseMuralFile(e.target.files?.[0])}/></label><button onClick={publishMuralEntry} disabled={muralBusy||(!muralText.trim()&&!muralFile)}>{muralBusy?"Publicando...":"Publicar recado"}</button></div></div>}
        {muralPrivate&&!isOwner&&<p className="profile-mural-private-note"><Lock size={15}/> Este mural está privado para comentários. Você ainda pode ver todos os recados. ♡</p>}
        {muralEntries.length===0?<div className="profile-empty"><MessageCircle size={27}/><strong>Seu mural está esperando carinho!</strong><p>Quando alguém deixar um recadinho, ele aparecerá aqui. ♡</p></div>:<div className="profile-mural-list">{muralEntries.map(entry=><article className="profile-mural-entry" key={entry.id}>{entry.is_pinned&&<span className="profile-mural-pinned">📌 Fixado no mural</span>}<div className="profile-mural-author">{entry.author?.avatar_url?<img src={entry.author.avatar_url} alt=""/>:<i>{(entry.author?.display_name||entry.author?.username||"?").charAt(0).toUpperCase()}</i>}<span><strong>{entry.author?.display_name||"Pessoa Mimimi"}</strong><small>@{entry.author?.username||"usuario"} · {new Date(entry.created_at).toLocaleDateString("pt-BR")}</small></span></div>{entry.content&&<p>{entry.content}</p>}{entry.media_url&&<img className="profile-mural-media" src={entry.media_url} alt="Imagem ou GIF do mural"/>}
        <div className="mural-replies">{(entry.replies||[]).map(reply=><div className="mural-reply" key={reply.id}><div className="profile-mural-author">{reply.author?.avatar_url?<img src={reply.author.avatar_url} alt=""/>:<i>{(reply.author?.display_name||reply.author?.username||"?").charAt(0).toUpperCase()}</i>}<span><strong>{reply.author?.display_name||"Pessoa Mimimi"}</strong><small>@{reply.author?.username||"usuario"} · {new Date(reply.created_at).toLocaleDateString("pt-BR")}</small></span></div><p>{reply.content}</p>{(isOwner||reply.author_id===currentUserId)&&<button className="mural-reply-delete" onClick={()=>void deleteMuralReply(reply)}><Trash2 size={12}/> Apagar resposta</button>}</div>)}</div>
        {(!muralPrivate||isOwner)&&<><button className="mural-reply-trigger" onClick={()=>setMuralReplyOpen(muralReplyOpen===entry.id?"":entry.id)}><MessageCircle size={14}/> Responder ({(entry.replies||[]).length})</button>{muralReplyOpen===entry.id&&<div className="mural-reply-compose"><textarea value={muralReplyTexts[entry.id]||""} maxLength={1000} onChange={e=>setMuralReplyTexts(old=>({...old,[entry.id]:e.target.value}))} placeholder="Escreva sua resposta... 💗"/><button disabled={muralBusy||!(muralReplyTexts[entry.id]||"").trim()} onClick={()=>void sendMuralReply(entry)}><Send size={14}/> Enviar</button></div>}</>}
        {isOwner&&<div className="profile-mural-actions"><button onClick={()=>manageMuralEntry(entry,"pin")}>{entry.is_pinned?"Desafixar":"Fixar"}</button><button onClick={()=>manageMuralEntry(entry,"delete")}>Apagar</button></div>}</article>)}</div>}
      </div>}
        {tab==="Sobre mim"&&<div className="profile-about"><h2>Sobre mim</h2><p>{profile.bio||"Ainda não adicionou uma biografia."}</p><span>Membro do Mimimi desde {joined}</span></div>}
      </section>
      <footer className="profile-footer">Feito com carinho ♡ Mimimi</footer>
      {listOpen&&<div className="profile-modal-backdrop" onClick={()=>setListOpen(false)}><section className="profile-people-modal" onClick={e=>e.stopPropagation()}><header><strong>{listTitle}</strong><button onClick={()=>setListOpen(false)} aria-label="Fechar"><X size={19}/></button></header>
        {listLoading?<p className="profile-list-note">Carregando...</p>:listTitle==="Quem visitou"&&stats.viewers_hidden&&!isOwner?<div className="profile-hidden-viewers"><Lock size={22}/><strong>Visitantes privados</strong><p>O dono deste perfil ocultou os nomes e as fotos. Total de visitas: {stats.views_count}.</p><div className="profile-blurred-row"><i/><span/><b/></div><div className="profile-blurred-row"><i/><span/><b/></div></div>:socialList.length===0?<p className="profile-list-note">Ainda não há pessoas por aqui. ♡</p>:<div className="profile-people-list">{socialList.map(person=><div className="profile-person" key={person.auth_user_id}>{person.avatar_url?<img src={person.avatar_url} alt=""/>:<i>{(person.display_name||person.username||"?").charAt(0).toUpperCase()}</i>}<span><strong>{person.display_name||"Pessoa Mimimi"}</strong><small>@{person.username||"usuario"}</small></span></div>)}</div>}
      </section></div>}
    </main>
  );
}
