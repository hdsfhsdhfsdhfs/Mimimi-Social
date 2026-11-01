"use client";

import { type FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Mail, Lock, ArrowLeft, UserRound, Eye, EyeOff, Heart } from "lucide-react";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [splash, setSplash] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setSplash(false), 2200);
    return () => window.clearTimeout(timer);
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage(""); setError("");
    try {
      const supabase = getSupabase();
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { data: { display_name: displayName.trim() }, emailRedirectTo: window.location.origin }
        });
        if (authError) throw authError;
        if (data.session) setMessage("Conta criada! Seja bem-vindo ao Mimimi 💗");
        else { setMessage("Quase lá! Confira seu e-mail e confirme o cadastro para entrar."); setMode("login"); }
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
        if (authError) throw authError;
        setMessage("Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.");
    } finally { setBusy(false); }
  }

  if (splash) return (
    <main className="mimi-entry mimi-splash">
      <section className="mimi-splash-panel">
        <div className="mimi-cloud cloud-a" /><div className="mimi-cloud cloud-b" />
        <div className="mimi-script-logo">Mimimi<span className="logo-ears" aria-hidden="true"><i /><i /></span><i /></div>
        <div className="splash-bottom"><div className="splash-progress"><span /></div><p>Carregando sua experiência...</p><Heart size={15} fill="currentColor" /></div>
        <span className="mimi-star star-a">✦</span><span className="mimi-star star-b">✧</span><span className="mimi-star star-c">✦</span>
      </section>
    </main>
  );

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Bem-vindo de volta!";
  const subtitle = mode === "signup" ? "Seu cantinho está esperando por você" : mode === "reset" ? "Vamos enviar um link para o seu e-mail" : "Conecte-se com pessoas incríveis";

  return (
    <main className="mimi-entry mimi-auth-entry">
      <section className="mimi-login-shell">
        <div className="mimi-login-art">
          <div className="mimi-cloud cloud-a" /><div className="mimi-cloud cloud-b" />
          <div className="mimi-script-logo">Mimimi<span className="logo-ears" aria-hidden="true"><i /><i /></span><i /></div>
          <span className="mimi-star star-a">✦</span><span className="mimi-star star-b">✧</span><span className="mimi-star star-c">✦</span>
          <div className="art-footer">Um cantinho feito para você <Heart size={15} fill="currentColor" /></div>
        </div>
        <div className="mimi-login-form-panel">
          <div className="mimi-cloud cloud-a" /><div className="mimi-cloud cloud-b" />
          <div className="mimi-form-inner">
            <div className="mimi-mini-logo">Mimimi<span className="logo-ears" aria-hidden="true"><i /><i /></span><i /></div>
            <h1>{title}</h1><p className="mimi-subtitle">{subtitle}</p><Heart className="form-heart" size={14} fill="currentColor" />
            <form className="mimi-form" onSubmit={submit}>
              {mode === "signup" && <label className="mimi-field"><UserRound size={19} /><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como podemos chamar você?" autoComplete="name" required maxLength={50} /></label>}
              <label className="mimi-field"><Mail size={19} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Usuário ou e-mail" autoComplete="email" required /></label>
              {mode !== "reset" && <label className="mimi-field"><Lock size={19} /><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required /><button type="button" className="mimi-eye" aria-label="Mostrar ou ocultar senha" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></label>}
              {mode === "login" && <button className="mimi-forgot" type="button" onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Esqueceu sua senha?</button>}
              <button className="mimi-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "signup" ? "Criar nova conta" : mode === "reset" ? "Enviar link de recuperação" : "Entrar"}</button>
            </form>
            {message && <p className="mimi-feedback" role="status">{message}</p>}
            {error && <p className="mimi-feedback error" role="alert">{error}</p>}
            {mode === "reset" ? <button className="mimi-back" onClick={() => { setMode("login"); setMessage(""); setError(""); }}><ArrowLeft size={15} /> Voltar para entrar</button> : <><div className="mimi-or"><span />ou<span /></div><button className="mimi-create" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); setError(""); }}>{mode === "signup" ? "Já tenho uma conta" : "Criar nova conta"}</button>{mode === "login" && <div className="mimi-social-row"><button className="mimi-social" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const { error: oauthError } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } } }); if (oauthError) throw oauthError; } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar com Google."); } finally { setBusy(false); } }}><svg className="mimi-google-mark" aria-hidden="true" viewBox="0 0 48 48" width="18" height="18"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.6c3.9-3.6 6.1-8.8 6.1-15Z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.6-5.1c-1.8 1.2-4.1 2-6.9 2-5.3 0-9.8-3.6-11.4-8.4H5.8v5.3A20 20 0 0 0 24 44Z"/><path fill="#FBBC05" d="M12.6 27.6a12 12 0 0 1 0-7.2v-5.3H5.8a20 20 0 0 0 0 17.8l6.8-5.3Z"/><path fill="#EA4335" d="M24 11.9c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.9 29.5 4 24 4A20 20 0 0 0 5.8 15.1l6.8 5.3c1.6-4.8 6.1-8.5 11.4-8.5Z"/></svg> Continuar com Google</button></div>}</>}
            <p className="mimi-love">Juntos somos mais mimimi! <Heart size={14} /></p>
            <p className="mimi-support">Precisa de ajuda? support.mimimi@gmail.com</p>
          </div>
          <div className="mimi-cloud cloud-bottom" />
        </div>
      </section>
    </main>
  );
}
