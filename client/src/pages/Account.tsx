import { useState } from "react";
import { Link } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { formatINR } from "@/lib/shop";

type Mode = "login" | "register" | "forgot";

export default function Account() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const me = trpc.customer.me.useQuery();
  const orders = trpc.customer.orders.useQuery(undefined, { enabled: Boolean(me.data), retry: false });
  const logout = trpc.customer.logout.useMutation({ onSuccess: () => { void me.refetch(); toast.success("You’re signed out."); } });
  if (me.isLoading) return <AccountShell><div className="account-panel">Checking your account…</div></AccountShell>;
  if (me.data) return <AccountShell><section className="account-panel account-dashboard"><div className="account-heading"><div><span className="eyebrow">YOUR LITTLE BAZAAR</span><h1>Welcome, {me.data.name.split(" ")[0]}.</h1><p>{me.data.email}</p></div><button className="button button-outline" onClick={() => logout.mutate()}>Sign out</button></div><h2>Your orders</h2>{orders.isLoading ? <p className="account-muted">Loading your orders…</p> : orders.data?.length ? <div className="account-orders">{orders.data.map(order => <article className="account-order" key={order.id}><div className="account-order-top"><div><strong>{order.orderNumber}</strong><small>{new Date(order.createdAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}</small></div><span className={`account-status account-status-${order.status}`}>{order.status}</span></div><div className="account-order-items">{order.items.map(item => <span key={item.id}>{item.quantity} × {item.productName}</span>)}</div><b>{formatINR(order.total)}</b></article>)}</div> : <div className="account-empty"><h3>No orders linked yet</h3><p>Use this email at checkout and your future orders will appear here.</p><Link className="button button-primary" href="/">Start shopping</Link></div>}</section></AccountShell>;
  return <AccountShell><section className="account-panel"><span className="eyebrow">YOUR ACCOUNT</span><h1>{mode === "register" ? "Create your account" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1><p className="account-intro">{mode === "register" ? "Save your orders and follow their progress in one place." : mode === "forgot" ? "Answer your security question to choose a new password." : "Sign in to see your Little Bazaar orders."}</p>{mode === "login" ? <LoginForm onSuccess={() => void me.refetch()} /> : mode === "register" ? <RegisterForm onSuccess={() => void me.refetch()} /> : <ForgotForm email={email} setEmail={setEmail} onDone={() => setMode("login")} />}<div className="account-switch">{mode === "login" ? <><button onClick={() => setMode("register")}>Create an account</button><button onClick={() => setMode("forgot")}>Forgot password?</button></> : <button onClick={() => setMode("login")}>Back to sign in</button>}</div></section></AccountShell>;
}

function AccountShell({ children }: { children: React.ReactNode }) {
  return <div className="account-page"><header className="account-top"><Link href="/" className="brand-lockup"><span className="brand-mark"><i /><i /><i /><i /></span><span className="brand-name">little bazaar<span>.</span></span></Link><Link href="/" className="account-back">Back to shop</Link></header><main>{children}</main></div>;
}
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const login = trpc.customer.login.useMutation({ onSuccess, onError: error => toast.error(error.message) });
  return <form className="account-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); login.mutate({ email: String(data.get("email")), password: String(data.get("password")) }); }}><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password<input name="password" type="password" required autoComplete="current-password" /></label><button className="button button-primary full" disabled={login.isPending}>{login.isPending ? "Signing in…" : "Sign in"}</button></form>;
}
function RegisterForm({ onSuccess }: { onSuccess: () => void }) {
  const question = trpc.customer.securityQuestion.useQuery();
  const register = trpc.customer.register.useMutation({ onSuccess, onError: error => toast.error(error.message) });
  return <form className="account-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); register.mutate({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")), securityQuestion: question.data ?? "What is your favourite food?", securityAnswer: String(data.get("answer")) }); }}><label>Name<input name="name" required minLength={2} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Password <small>8 characters minimum</small><input name="password" type="password" required minLength={8} autoComplete="new-password" /></label><label>Security question<small>{question.data ?? "Loading question…"}</small><input name="answer" required placeholder="Your answer" /></label><button className="button button-primary full" disabled={register.isPending || question.isLoading}>{register.isPending ? "Creating…" : "Create account"}</button></form>;
}
function ForgotForm({ email, setEmail, onDone }: { email: string; setEmail: (value: string) => void; onDone: () => void }) {
  const [questionVisible, setQuestionVisible] = useState(false);
  const question = trpc.customer.recoveryQuestion.useQuery({ email }, { enabled: questionVisible && email.includes("@") });
  const reset = trpc.customer.resetPassword.useMutation({ onSuccess: () => { toast.success("Password reset. You can sign in now."); onDone(); }, onError: error => toast.error(error.message) });
  return <form className="account-form" onSubmit={event => { event.preventDefault(); const data = new FormData(event.currentTarget); if (!questionVisible) { setEmail(String(data.get("email"))); setQuestionVisible(true); return; } reset.mutate({ email, answer: String(data.get("answer")), newPassword: String(data.get("password")) }); }}><label>Email<input name="email" type="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>{questionVisible && <><p className="account-question">{question.data ?? "No account found for this email."}</p><label>Answer<input name="answer" required /></label><label>New password<input name="password" type="password" required minLength={8} /></label></>}<button className="button button-primary full" disabled={reset.isPending}>{questionVisible ? "Reset password" : "Continue"}</button></form>;
}
