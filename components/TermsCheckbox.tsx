import type { ComponentProps } from "react"
import Link from "next/link"

// Case obligatoire « 18 ans + CGV + politique de confidentialité », identique sur l'inscription,
// l'activation d'un compte entreprise et la candidature partenaire. Les liens ouvrent un nouvel onglet
// pour ne pas perdre la saisie. Accepte les props d'un <input> (dont le `register` de react-hook-form).
export function TermsCheckbox({
  id = "acceptTerms",
  error,
  ...inputProps
}: Omit<ComponentProps<"input">, "type"> & { error?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          type="checkbox"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          aria-invalid={!!error}
          aria-required="true"
          aria-describedby={error ? `${id}-error` : undefined}
          {...inputProps}
        />
        <label htmlFor={id} className="text-xs leading-relaxed text-muted-foreground max-lg:min-h-11">
          Je certifie avoir 18 ans ou plus et j&apos;accepte les{" "}
          <Link
            href="/cgv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            CGV
          </Link>{" "}
          et la{" "}
          <Link
            href="/politique-de-confidentialite"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4 hover:no-underline"
          >
            politique de confidentialité
          </Link>
        </label>
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
