"use client";

import { type FormEvent, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Mail, Lock, ArrowLeft, UserRound, Eye, EyeOff, Heart, Phone, Chrome } from "lucide-react";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup" | "reset" | "phone">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneCodeSent, setPhoneCodeSent] = useState(false);
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
      if (mode === "phone") {
        if (!phoneCodeSent) {
          const { error: otpError } = await supabase.auth.signInWithOtp({ phone: phone.trim() });
          if (otpError) throw otpError;
          setPhoneCodeSent(true);
          setMessage("Enviamos um código por SMS. Digite-o aqui para entrar no Mimimi.");
        } else {
          const { error: verifyError } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: phoneCode.trim(), type: "sms" });
          if (verifyError) throw verifyError;
        }
      } else if (mode === "signup") {
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

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : mode === "phone" ? "Entre com telefone" : "Bem-vindo de volta!";
  const subtitle = mode === "signup" ? "Seu cantinho está esperando por você" : mode === "reset" ? "Vamos enviar um link para o seu e-mail" : mode === "phone" ? "Vamos enviar um código por SMS" : "Conecte-se com pessoas incríveis";

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
              {mode === "phone" ? <><label className="mimi-field"><Phone size={19} /><input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" autoComplete="tel" required /></label>{phoneCodeSent && <label className="mimi-field"><Lock size={19} /><input inputMode="numeric" autoComplete="one-time-code" value={phoneCode} onChange={e => setPhoneCode(e.target.value)} placeholder="Código recebido por SMS" required /></label>}</> : <>{mode === "signup" && <label className="mimi-field"><UserRound size={19} /><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Como podemos chamar você?" autoComplete="name" required maxLength={50} /></label>}
              <label className="mimi-field"><Mail size={19} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Usuário ou e-mail" autoComplete="email" required /></label>
              {mode !== "reset" && <label className="mimi-field"><Lock size={19} /><input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required /><button type="button" className="mimi-eye" aria-label="Mostrar ou ocultar senha" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></label>}
              {mode === "login" && <button className="mimi-forgot" type="button" onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Esqueceu sua senha?</button>}
              <button className="mimi-submit" type="submit" disabled={busy}>{busy ? "Aguarde..." : mode === "signup" ? "Criar nova conta" : mode === "reset" ? "Enviar link de recuperação" : mode === "phone" ? (phoneCodeSent ? "Confirmar código" : "Enviar código por SMS") : "Entrar"}</button>
              </>}
            </form>
            {message && <p className="mimi-feedback" role="status">{message}</p>}
            {error && <p className="mimi-feedback error" role="alert">{error}</p>}
            {mode === "login" && <><button className="mimi-create mimi-social" type="button" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const { error: oauthError } = await getSupabase().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } }); if (oauthError) throw oauthError; } catch (err) { setError(err instanceof Error ? err.message : "Não foi possível entrar com Google."); } finally { setBusy(false); } }}><Chrome size={17} /> Continuar com Google</button><button className="mimi-create mimi-social" type="button" onClick={() => { setMode("phone"); setPhoneCodeSent(false); setPhone(""); setPhoneCode(""); setMessage(""); setError(""); }}><Phone size={17} /> Entrar com telefone</button></>}
            {mode === "reset" || mode === "phone" ? <button className="mimi-back" onClick={() => { setMode("login"); setPhoneCodeSent(false); setMessage(""); setError(""); }}><ArrowLeft size={15} /> Voltar para entrar</button> : <><div className="mimi-or"><span />ou<span /></div><button className="mimi-create" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); setError(""); }}>{mode === "signup" ? "Já tenho uma conta" : "Criar nova conta"}</button></>}
            <p className="mimi-love">Juntos somos mais mimimi! <Heart size={14} /></p>
            <p className="mimi-support">Precisa de ajuda? support.mimimi@gmail.com</p>
          </div>
          <div className="mimi-cloud cloud-bottom" />
        </div>
      </section>
    </main>
  );
}
