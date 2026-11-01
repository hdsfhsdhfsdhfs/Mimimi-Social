"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { ArrowRight, Camera, Heart, UserRound } from "lucide-react";

export default function CreateProfilePage() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function prepare() {
      const supabase = getSupabase();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      if (!active) return;
      setUserId(user.id);
      setDisplayName(String(user.user_metadata?.display_name || user.user_metadata?.full_name || ""));
      const { data } = await supabase.from("profiles").select("username,display_name,bio,avatar_url").eq("auth_user_id", user.id).maybeSingle();
      if (!active) return;
      if (data?.username) { router.replace("/"); return; }
      if (data?.display_name) setDisplayName(data.display_name);
      if (data?.bio) setBio(data.bio);
      if (data?.avatar_url) setPreview(data.avatar_url);
    }
    void prepare();
    return () => { active = false; };
  }, [router]);

  function chooseAvatar(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMessage("Escolha uma imagem JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage("Sua foto deve ter no máximo 5 MB.");
      return;
    }
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
    setMessage("");
  }

  async function finishProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || busy) return;
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, "");
    if (!cleanName) { setMessage("Digite o nome que deseja mostrar."); return; }
    if (!/^[a-z0-9._]{3,20}$/.test(cleanUsername)) {
      setMessage("Seu @ deve ter de 3 a 20 caracteres: letras, números, ponto ou underline.");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = getSupabase();
    try {
      let avatarUrl: string | null = null;
      if (avatarFile) {
        const extension = avatarFile.type === "image/jpeg" ? "jpg" : avatarFile.type.split("/")[1];
        const path = userId + "/avatar-" + Date.now() + "." + extension;
        const { error: uploadError } = await supabase.storage.from("profile-assets").upload(path, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (uploadError) throw uploadError;
        avatarUrl = supabase.storage.from("profile-assets").getPublicUrl(path).data.publicUrl;
      } else if (preview.startsWith("http")) {
        avatarUrl = preview;
      }
      const { error } = await supabase.from("profiles").upsert({
        auth_user_id: userId,
        display_name: cleanName,
        username: cleanUsername,
        bio: bio.trim().slice(0, 160),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: "auth_user_id" });
      if (error) {
        if (error.code === "23505") throw new Error("Esse @ já está sendo usado. Tente outro.");
        throw error;
      }
      router.replace("/");
      router.refresh();
    } catch (error: any) {
      setMessage(error?.message || "Não foi possível salvar seu perfil. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <main className="mimimi-onboarding">
      <form className="mimimi-onboarding-card" onSubmit={finishProfile}>
        <div className="mimimi-onboarding-brand"><img src="/mimimi-icon.webp" alt="" /><span>Mimimi</span></div>
        <div className="mimimi-onboarding-heart"><Heart size={17} fill="currentColor" /></div>
        <p className="mimimi-onboarding-kicker">SEU CANTINHO COMEÇA AQUI</p>
        <h1>Crie seu perfil</h1>
        <p className="mimimi-onboarding-subtitle">Conte um pouquinho sobre você antes de entrar no Mimimi. Você poderá mudar tudo depois! 💗</p>

        <label className="mimimi-onboarding-avatar" htmlFor="profile-avatar">
          {preview ? <img src={preview} alt="Prévia da sua foto de perfil" /> : <span><UserRound size={34} /></span>}
          <i><Camera size={16} /></i>
        </label>
        <input id="profile-avatar" className="mimimi-onboarding-file" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => chooseAvatar(e.target.files?.[0])} />
        <span className="mimimi-onboarding-photo-hint">Adicionar foto (opcional)</span>

        <label className="mimimi-onboarding-field"><span>Como quer ser chamado(a)?</span><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" maxLength={50} required /></label>
        <label className="mimimi-onboarding-field"><span>Escolha seu @</span><div className="mimimi-onboarding-username"><b>@</b><input value={username} onChange={e => setUsername(e.target.value.replace(/^@/, ""))} placeholder="seuusuario" minLength={3} maxLength={20} required /></div><small>De 3 a 20 caracteres. Esse será seu identificador no Mimimi.</small></label>
        <label className="mimimi-onboarding-field"><span>Bio <small>· opcional</small></span><textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Escreva algo sobre você..." maxLength={160} rows={3} /></label>
        {message && <p className="mimimi-onboarding-message" role="alert">{message}</p>}
        <button className="mimimi-onboarding-submit" type="submit" disabled={busy}>{busy ? "Salvando seu cantinho..." : <>Salvar alterações <ArrowRight size={19} /></>}</button>
        <p className="mimimi-onboarding-foot">Feito com carinho para você <Heart size={12} fill="currentColor" /></p>
      </form>
    </main>
  );
}
