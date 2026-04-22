export function FullscreenState(props: {
  tone: 'loading' | 'error' | 'empty';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="screen state-screen">
      <section className={`panel state-panel is-${props.tone}`}>
        <p className="eyebrow">{labelForTone(props.tone)}</p>
        <h1>{props.title}</h1>
        <p className="body-copy">{props.description}</p>
        {props.actionLabel && props.onAction ? (
          <button type="button" className="primary-button" onClick={props.onAction}>
            {props.actionLabel}
          </button>
        ) : null}
      </section>
    </main>
  );
}

export function InlineState(props: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <section className="panel">
      <h2>{props.title}</h2>
      <p className="body-copy">{props.description}</p>
      {props.actionLabel && props.onAction ? (
        <button type="button" className="secondary-button" onClick={props.onAction}>
          {props.actionLabel}
        </button>
      ) : null}
    </section>
  );
}

export function InlineNotice(props: {
  tone: 'error' | 'success' | 'info';
  title: string;
  description: string;
}) {
  return (
    <section className={`inline-notice is-${props.tone}`}>
      <strong>{props.title}</strong>
      <p>{props.description}</p>
    </section>
  );
}

export function ScreenHeader({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="panel-header">
      <h2>{title}</h2>
      {caption ? <span>{caption}</span> : null}
    </div>
  );
}

function labelForTone(tone: 'loading' | 'error' | 'empty') {
  if (tone === 'loading') {
    return 'Загрузка';
  }

  if (tone === 'error') {
    return 'Ошибка';
  }

  return 'Пауза';
}
