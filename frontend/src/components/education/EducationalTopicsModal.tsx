import { BookOpen } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button, Modal } from '../ui'

const TOPICS: { id: string; title: string; body: ReactNode }[] = [
  {
    id: 'entropy',
    title: 'Entropy (teaching model)',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          Entropy estimates how many bits of uncertainty an attacker would face if they had to guess your password
          assuming a simplified model. Real attackers use dictionaries, leaked lists, and rules — so displayed entropy is
          an upper bound for teaching, not a guarantee of safety.
        </p>
        <p className="text-xs text-zinc-500">We never write your password to logs or exports; only derived numbers are stored.</p>
      </div>
    ),
  },
  {
    id: 'hashing',
    title: 'Hashing vs encryption',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          <strong className="text-white">Hashing</strong> (bcrypt / Argon2id) is one-way: the app verifies a login password by
          recomputing a slow hash and comparing. <strong className="text-white">Encryption</strong> (Fernet in this demo vault) is
          reversible so you can retrieve secrets — anyone with the database <em>and</em> server key material could decrypt.
        </p>
        <p className="text-xs text-zinc-500">Production vaults often add a user-held master password or client-side encryption.</p>
      </div>
    ),
  },
  {
    id: 'breach',
    title: 'Breach checking (HIBP)',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          Have I Been Pwned uses k-anonymity: only the first five hex characters of your password&apos;s SHA-1 digest are sent
          over TLS. The server returns a bucket of suffixes; your browser or API matches locally. Full passwords are never
          uploaded to HIBP.
        </p>
        <p className="text-xs text-zinc-500">Optional offline hash files can be used when the network is unavailable.</p>
      </div>
    ),
  },
  {
    id: 'encryption',
    title: 'Vault encryption (demo model)',
    body: (
      <div className="space-y-3 text-sm leading-relaxed text-zinc-300">
        <p>
          Vault entries are encrypted at rest with per-user keys derived from a server pepper. Plaintext exists only briefly in
          memory for reveal, copy, and analysis flows. CSV/PDF reports intentionally include <strong className="text-white">metadata only</strong> — no
          decrypted passwords.
        </p>
        <p className="text-xs text-zinc-500">Reuse detection stores an HMAC token, not the password itself.</p>
      </div>
    ),
  },
]

export function EducationalTopicsModal() {
  const [open, setOpen] = useState(false)
  const [topicId, setTopicId] = useState(TOPICS[0].id)
  const topic = TOPICS.find((t) => t.id === topicId) ?? TOPICS[0]

  return (
    <>
      <Button type="button" variant="secondary" size="sm" leftIcon={<BookOpen className="h-3.5 w-3.5" aria-hidden />} onClick={() => setOpen(true)}>
        Security concepts
      </Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Security concepts"
        description="Short, assessment-friendly explanations. Not a substitute for formal cryptography review."
        size="lg"
        footer={
          <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="flex flex-col gap-4 md:flex-row">
          <nav className="flex shrink-0 flex-col gap-1 md:w-48" aria-label="Topics">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTopicId(t.id)}
                className={`rounded-lg px-3 py-2 text-left text-sm transition ${
                  topicId === t.id ? 'bg-emerald-500/20 text-emerald-100' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                {t.title}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 border-t border-white/10 pt-4 md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <h3 className="text-lg font-semibold text-white">{topic.title}</h3>
            <div className="mt-3">{topic.body}</div>
          </div>
        </div>
      </Modal>
    </>
  )
}
