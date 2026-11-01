"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowLeft, Edit3, MessageCircle, MoreHorizontal, Save, Users, Eye, UserPlus, UserCheck, X, Lock } from "lucide-react";

type Profile = {
  id: number; auth_user_id: string; username: string | null; display_name: string | null;
  bio: string; avatar_url: string | null; background_url: string | null;
  is_official: boolean; role_label: string | null; role_description: string | null;
  created_at: string; hide_profile_visitors?: boolean;
};
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
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [stats, setStats] = useState<SocialStats>({followers_count:0,following_count:0,views_count:0,is_following:false,viewers:[],viewers_hidden:false});
  const [socialList, setSocialList] = useState<Person[]>([]);
  const [listTitle, setListTitle] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [hideVisitors, setHideVisitors] = useState(false);
  const [privacyBusy, setPrivacyBusy] = useState(false);
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
      let query = supabase.from("profiles").select("id, auth_user_id, username, display_name, bio, avatar_url, background_url, is_official, role_label, role_description, created_at, hide_profile_visitors");
      if (requestedUsername) query = query.eq("username", requestedUsername.replace(/^@/, "").toLowerCase());
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
      await supabase.rpc("record_profile_view", { target_profile_id: current.auth_user_id });
      const { data: social } = await supabase.rpc("get_profile_social_stats", { target_profile_id: current.auth_user_id });
      if (active && social) setStats({...social as SocialStats, viewers: (social as SocialStats).viewers || []});
      if (active) setLoading(false);
    }
    loadProfile();
    return () => { active = false; };
  }, [router]);

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
    setSaving(true); setMessage("");
    const supabase = getSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace("/"); return; }
    try {
      let avatarUrl = profile.avatar_url, backgroundUrl = profile.background_url;
      if (avatarFile) avatarUrl = await uploadSelectedImage(avatarFile, "avatar", user.id);
      if (backgroundFile) backgroundUrl = await uploadSelectedImage(backgroundFile, "background", user.id);
      const values = {auth_user_id:user.id,display_name:cleanName,username:cleanUsername||null,bio:bio.trim().slice(0,160),avatar_url:avatarUrl,background_url:backgroundUrl,updated_at:new Date().toISOString()};
      const {data,error} = await supabase.from("profiles").upsert(values,{onConflict:"auth_user_id"}).select("id, auth_user_id, username, display_name, bio, avatar_url, background_url, is_official, role_label, role_description, created_at, hide_profile_visitors").single();
      if (error) setMessage(error.code==="23505" ? "Esse @usuário já está sendo usado. Escolha outro." : `Erro ao salvar: ${error.message}`);
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

  return (
    <main className="profile-page" style={profile.background_url?{backgroundImage:`linear-gradient(180deg,rgba(33,25,35,.35),rgba(33,25,35,.82)),url("${profile.background_url}")`,backgroundSize:"cover",backgroundPosition:"center top",backgroundAttachment:"fixed"}:undefined}>
      <header className="profile-topbar">
        <button className="profile-back" onClick={()=>router.push("/")} aria-label="Voltar ao início"><ArrowLeft size={20}/></button>
        <strong>Mimimi</strong>
        <div className="profile-more-wrap"><button className="profile-back" aria-label="Mais opções" aria-expanded={moreMenuOpen} onClick={()=>setMoreMenuOpen(v=>!v)}><MoreHorizontal size={21}/></button>{moreMenuOpen&&<div className="profile-more-menu">{isOwner?<><strong>Privacidade</strong><div className="profile-more-privacy"><span><b>Quem visitou meu perfil</b><small>{hideVisitors?"Somente você pode ver os visitantes.":"Todos podem ver os visitantes."}</small></span><label className="profile-switch"><input type="checkbox" checked={hideVisitors} disabled={privacyBusy} onChange={e=>updateVisitorPrivacy(e.target.checked)}/><span/></label></div></>:<p>Opções do perfil</p>}</div>}</div>
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
          <p className="profile-bio">{profile.bio||"Este cantinho está esperando por uma descrição especial. ♡"}</p>
          {isOwner ? <button className="profile-edit-button" onClick={()=>{setEditing(!editing);setMessage("");}}><Edit3 size={16}/>{editing?"Fechar edição":"Editar perfil"}</button> : <button className="profile-follow-button" onClick={toggleFollow} disabled={followingBusy}>{stats.is_following?<><UserCheck size={16}/> Seguindo</>:<><UserPlus size={16}/> Seguir</>}</button>}
        </div>
        <div className="profile-stats">
          <button onClick={()=>openPeopleList("followers")}><strong>{stats.followers_count}</strong><span><Users size={14}/> Seguidores</span></button>
          <button onClick={()=>openPeopleList("following")}><strong>{stats.following_count}</strong><span><Users size={14}/> Seguindo</span></button>
          <button onClick={()=>openPeopleList("viewers")}><strong>{stats.views_count}</strong><span><Eye size={14}/> Visitas</span></button>
        </div>
      </section>
      {editing&&isOwner&&<section className="profile-edit-card">
        <div className="profile-edit-heading"><strong>Seu cantinho, suas escolhas</strong><span>Personalize suas informações</span></div>
        <label>Nome de exibição<input value={displayName} maxLength={40} onChange={e=>setDisplayName(e.target.value)} placeholder="Como quer ser chamado?"/></label>
        <label>@Nome de usuário<input value={username} maxLength={20} onChange={e=>setUsername(e.target.value.replace(/^@/,""))} placeholder="seuusuario"/></label>
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
        {tab==="Publicações"&&<div className="profile-empty"><span>✧</span><strong>Suas histórias começam aqui</strong><p>Quando você publicar algo, suas publicações aparecerão neste espaço.</p></div>}
        {tab==="Mural"&&<div className="profile-empty"><MessageCircle size={27}/><strong>Seu mural está chegando!</strong><p>Em breve, seus amigos poderão deixar mensagens neste cantinho.</p></div>}
        {tab==="Sobre mim"&&<div className="profile-about"><h2>Sobre mim</h2><p>{profile.bio||"Ainda não adicionou uma biografia."}</p><span>Membro do Mimimi desde {joined}</span></div>}
      </section>
      <footer className="profile-footer">Feito com carinho ♡ Mimimi</footer>
      {listOpen&&<div className="profile-modal-backdrop" onClick={()=>setListOpen(false)}><section className="profile-people-modal" onClick={e=>e.stopPropagation()}><header><strong>{listTitle}</strong><button onClick={()=>setListOpen(false)} aria-label="Fechar"><X size={19}/></button></header>
        {listLoading?<p className="profile-list-note">Carregando...</p>:listTitle==="Quem visitou"&&stats.viewers_hidden&&!isOwner?<div className="profile-hidden-viewers"><Lock size={22}/><strong>Visitantes privados</strong><p>O dono deste perfil ocultou os nomes e as fotos. Total de visitas: {stats.views_count}.</p><div className="profile-blurred-row"><i/><span/><b/></div><div className="profile-blurred-row"><i/><span/><b/></div></div>:socialList.length===0?<p className="profile-list-note">Ainda não há pessoas por aqui. ♡</p>:<div className="profile-people-list">{socialList.map(person=><div className="profile-person" key={person.auth_user_id}>{person.avatar_url?<img src={person.avatar_url} alt=""/>:<i>{(person.display_name||person.username||"?").charAt(0).toUpperCase()}</i>}<span><strong>{person.display_name||"Pessoa Mimimi"}</strong><small>@{person.username||"usuario"}</small></span></div>)}</div>}
      </section></div>}
    </main>
  );
}
