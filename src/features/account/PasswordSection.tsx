import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { TextInput } from "@/components/ui/TextField";
import { toast } from "@/components/ui/Toast";
import {
  changePassword,
  hasPassword,
  sendPasswordReset,
  setNewPassword,
} from "@/features/auth/auth";
import { PasswordRules, passwordOk } from "@/features/auth/password";

/** Account → Password: set one (accounts made with Google) or change it. */
export function PasswordSection({ user }: { user: User }) {
  const has = hasPassword(user);
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [error, setError] = useState("");

  const reset = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setError("");
  };

  const save = async () => {
    if (has && !current) return setError("Enter your current password.");
    if (!passwordOk(next))
      return setError(
        "Your new password doesn’t meet all the requirements yet.",
      );
    setBusy("save");
    setError("");
    try {
      if (has) await changePassword(user.email!, current, next);
      else await setNewPassword(next);
      toast(
        has
          ? "Your password is changed."
          : "Password set. You can now also log in with your email.",
        "success",
      );
      reset();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const forgot = async () => {
    setBusy("reset");
    try {
      await sendPasswordReset(user.email!);
      toast(
        `We sent a link to ${user.email} to choose a new password.`,
        "success",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const eye = (
    <button
      type="button"
      onClick={() => setShow(!show)}
      aria-label={show ? "Hide passwords" : "Show passwords"}
      className="absolute top-1/2 right-2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-muted hover:text-fg"
    >
      {show ? (
        <EyeOff className="size-5" strokeWidth={2.2} />
      ) : (
        <Eye className="size-5" strokeWidth={2.2} />
      )}
    </button>
  );

  return (
    <section
      aria-labelledby="password-h"
      className="space-y-4 rounded-[var(--radius-panel)] bg-surface p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="password-h" className="text-[17px] font-bold">
            Password
          </h2>
          <p className="text-[14px] text-muted">
            {has
              ? "You can log in with your email and password."
              : "You log in with Google. Set a password to also log in with your email."}
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="quiet" onClick={() => setOpen(true)}>
            {has ? "Change password" : "Set a password"}
          </Button>
        )}
      </div>
      {open && (
        <form
          className="space-y-3"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {has && (
            <label className="block space-y-1.5">
              <span className="text-[13px] font-semibold text-muted">
                Current password
              </span>
              <span className="relative block">
                <TextInput
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  value={current}
                  className="pr-14"
                  onChange={(e) => (setCurrent(e.target.value), setError(""))}
                  aria-label="Current password"
                />
                {eye}
              </span>
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-[13px] font-semibold text-muted">
              New password
            </span>
            <span className="relative block">
              <TextInput
                type={show ? "text" : "password"}
                autoComplete="new-password"
                value={next}
                className="pr-14"
                onChange={(e) => (setNext(e.target.value), setError(""))}
                aria-label="New password"
              />
              {!has && eye}
            </span>
          </label>
          <PasswordRules password={next} />
          {error && (
            <p role="alert" className="text-[14px] font-medium text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" size="sm" disabled={!!busy}>
              {busy === "save" && <Spinner />}{" "}
              {has ? "Change password" : "Set password"}
            </Button>
            <Button size="sm" variant="text" onClick={reset}>
              Cancel
            </Button>
            {has && (
              <Button
                size="sm"
                variant="link"
                className="ml-auto px-0"
                disabled={!!busy}
                onClick={() => void forgot()}
              >
                {busy === "reset"
                  ? "Sending…"
                  : "Forgot your current password?"}
              </Button>
            )}
          </div>
        </form>
      )}
    </section>
  );
}
