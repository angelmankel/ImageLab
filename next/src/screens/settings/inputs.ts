/**
 * Mantine input styles for a settings row: elev background, strong hairline, 600 weight; the
 * mono variant for hosts and URLs. `CTL_WIDTH` is the width of a text control beside its label.
 */
export const CTL_WIDTH = 260;

export const inputStyles = {
  input: { background: 'var(--il-elev)', borderColor: 'var(--il-line-strong)', fontWeight: 600 },
} as const;

export const monoInputStyles = {
  input: { ...inputStyles.input, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 },
} as const;

/** Width of a text control: `--il-ctl-w` is set by SettingRow (260px beside the label, 100% when stacked). */
export const ctlStyle = { width: `var(--il-ctl-w, ${CTL_WIDTH}px)`, maxWidth: '100%' } as const;
