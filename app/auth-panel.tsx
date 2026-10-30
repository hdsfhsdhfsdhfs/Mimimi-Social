"use client";

import { FormEvent, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { Mail, Lock, ArrowLeft, Sparkles } from "lucide-react";

export default function AuthPanel() {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    try {
      const supabase = getSupabase();

      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() },
            emailRedirectTo: window.location.origin
          }
        });
        if (authError) throw authError;
        if (data.session) {
          setMessage("Conta criada! Seja bem-vindo ao Mimimi 💗");
        } else {
          setMessage("Quase lá! Confira seu e-mail e confirme o cadastro para entrar.");
          setMode("login");
        }
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password
        });
        if (authError) throw authError;
      } else {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: window.location.origin
        });
        if (authError) throw authError;
        setMessage("Se esse e-mail estiver cadastrado, você receberá um link para redefinir sua senha.");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Não foi possível concluir. Tente novamente.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Crie sua conta" : mode === "reset" ? "Recuperar senha" : "Que bom ter você de volta!";
  const subtitle = mode === "signup"
    ? "Seu cantinho está esperando por você."
    : mode === "reset"
      ? "Vamos enviar um link para o seu e-mail."
      : "Entre e continue suas conexões.";

  return (
    <main className="auth-page">
      <section className="auth-card">
        <a className="brand auth-brand" href="#"><span className="brand-mark">m</span><span>Mimimi</span></a>
        <div className="auth-bunny" aria-hidden="true"><span>♡</span><div className="auth-bunny-face"><i /><i /><b /></div></div>
        <span className="eyebrow"><Sparkles size={14} /> SEU CANTINHO NA INTERNET</span>
        <h1>{title}</h1>
        <p className="auth-subtitle">{subtitle}</p>

        <form className="auth-form" onSubmit={submit}>
          {mode === "signup" && (
            <label>
              Como podemos chamar você?
              <span className="auth-input"><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Seu nome" autoComplete="name" required maxLength={50} /></span>
            </label>
          )}
          <label>
            E-mail
            <span className="auth-input"><Mail size={17} /><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="voce@email.com" autoComplete="email" required /></span>
          </label>
          {mode !== "reset" && (
            <label>
              Senha
              <span className="auth-input"><Lock size={17} /><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Pelo menos 6 caracteres" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={6} required /></span>
            </label>
          )}
          {mode === "login" && <button className="auth-forgot" type="button" onClick={() => { setMode("reset"); setMessage(""); setError(""); }}>Esqueci minha senha</button>}
          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "Aguarde..." : mode === "signup" ? "Criar minha conta" : mode === "reset" ? "Enviar link de recuperação" : "Entrar"}
          </button>
        </form>

        {message && <p className="auth-message" role="status">{message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}

        {mode === "reset" ? (
          <button className="auth-switch" onClick={() => { setMode("login"); setMessage(""); setError(""); }}><ArrowLeft size={15} /> Voltar para entrar</button>
        ) : (
          <p className="auth-switch-copy">
            {mode === "signup" ? "Já tem uma conta?" : "Ainda não tem uma conta?"}
            <button className="auth-switch" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setMessage(""); setError(""); }}>
              {mode === "signup" ? "Entrar" : "Criar conta"}
            </button>
          </p>
        )}
        <p className="auth-footer">Feito com carinho ♡ Mimimi 2026</p>
      </section>
    </main>
  );
}
