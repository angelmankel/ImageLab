/**
 * An API key box that the browser's password manager leaves alone. A real `type="password"`
 * field made Chrome treat the page as a login form and offer saved passwords on the boxes next to
 * it (the AI model dropdown, Donny 10-20). This is a text input masked with CSS
 * (`-webkit-text-security`), with an eye to show it, and the opt-out hints the common managers read.
 */
import { useState } from 'react';
import { TextInput, type TextInputProps } from '@mantine/core';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

export function SecretInput({ styles, ...props }: Omit<TextInputProps, 'type' | 'rightSection'>) {
  const [shown, setShown] = useState(false);
  return (
    <TextInput
      {...props}
      type="text"
      autoComplete="off"
      spellCheck={false}
      autoCapitalize="off"
      data-1p-ignore
      data-lpignore="true"
      data-bwignore
      data-form-type="other"
      styles={{ ...(styles as object), input: { ...((styles as { input?: object } | undefined)?.input ?? {}), WebkitTextSecurity: shown ? 'none' : 'disc' } as React.CSSProperties }}
      rightSection={
        <button type="button" onClick={() => setShown((v) => !v)} aria-label={shown ? 'Hide key' : 'Show key'}
          style={{ width: 28, height: 28, border: 0, background: 'transparent', color: 'var(--il-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          {shown ? <IconEyeOff size={15} /> : <IconEye size={15} />}
        </button>
      }
    />
  );
}
