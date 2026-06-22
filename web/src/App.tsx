import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  HeartPulse,
  Hospital,
  LockKeyhole,
  MessageSquareText,
  MonitorSmartphone,
  Phone,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Trash2,
  UserRoundCheck
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { PartnerNotifyApiClient, PartnerNotifyApiError, TemplateCatalog } from './api';
import { getDeviceHash } from './deviceHash';
import {
  AppMode,
  ExposureType,
  MessageTone,
  NotificationDraft,
  exposureOptions,
  formatPhoneNumber,
  getAppMode,
  getTemplatePreviewFromCatalog,
  isSendDisabled,
  normalizePhoneNumber,
  toneOptions,
  validateNotificationDraft
} from './domain';
import { getRuntimeConfig } from './runtimeConfig';
import { TurnstileChallenge } from './TurnstileChallenge';

const testingLocatorUrl = 'https://gettested.cdc.gov/';

type Step = 'intro' | 'consent' | 'exposure' | 'recipients' | 'review' | 'sent';

type SendState =
  | { status: 'idle' }
  | { status: 'sending' }
  | { status: 'error'; message: string }
  | { status: 'sent'; requestId: string };

const initialDraft: NotificationDraft = {
  consentExposure: false,
  consentNoHarassment: false,
  exposureType: 'STI',
  tone: 'NEUTRAL',
  phoneNumbers: []
};

const stepOrder: Step[] = ['intro', 'consent', 'exposure', 'recipients', 'review', 'sent'];

export function App() {
  const runtime = useMemo(() => {
    try {
      return {
        config: getRuntimeConfig({
          DEV: import.meta.env.DEV,
          PROD: import.meta.env.PROD,
          VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
          VITE_TURNSTILE_SITE_KEY: import.meta.env.VITE_TURNSTILE_SITE_KEY
        }),
        error: null
      };
    } catch (error) {
      return {
        config: null,
        error: error instanceof Error ? error.message : 'Application configuration is invalid.'
      };
    }
  }, []);
  const [mode, setMode] = useState<AppMode>(() => getAppMode(new URL(window.location.href)));
  const [step, setStep] = useState<Step>('intro');
  const [draft, setDraft] = useState<NotificationDraft>(initialDraft);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [sendState, setSendState] = useState<SendState>({ status: 'idle' });
  const [templateCatalog, setTemplateCatalog] = useState<TemplateCatalog | null>(null);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const [turnstileResetSignal, setTurnstileResetSignal] = useState(0);
  const apiClient = useMemo(
    () => runtime.config ? new PartnerNotifyApiClient(runtime.config.apiBaseUrl) : null,
    [runtime.config]
  );
  const progress = Math.max(0, stepOrder.indexOf(step)) / (stepOrder.length - 1);
  const preview = getTemplatePreviewFromCatalog(templateCatalog, draft.exposureType, draft.tone);
  const isKiosk = mode === 'kiosk';
  const path = window.location.pathname;

  useEffect(() => {
    if (!apiClient) {
      return;
    }

    let cancelled = false;
    apiClient.getTemplates()
      .then((catalog) => {
        if (!cancelled) {
          setTemplateCatalog(catalog);
          setTemplateError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTemplateError(error instanceof Error ? error.message : 'Message templates could not be loaded.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiClient]);

  const resetTurnstile = useCallback(() => {
    setTurnstileToken('');
    setTurnstileResetSignal((value) => value + 1);
  }, []);

  const handleTurnstileToken = useCallback((token: string) => {
    setTurnstileToken(token);
    setTurnstileError(null);
  }, []);

  if (runtime.error) {
    return <StaticPage title="Configuration error" body={[runtime.error]} />;
  }

  if (path === '/privacy') {
    return <PrivacyPage />;
  }

  if (path === '/support') {
    return <SupportPage />;
  }

  if (path === '/testing') {
    return <TestingPage />;
  }

  if (path === '/report-abuse') {
    return <ReportAbusePage />;
  }

  function updateDraft(update: Partial<NotificationDraft>) {
    setDraft((current) => ({ ...current, ...update }));
  }

  function next() {
    const index = stepOrder.indexOf(step);
    const nextStep = stepOrder[index + 1];
    if (nextStep) {
      setStep(nextStep);
    }
  }

  function back() {
    const index = stepOrder.indexOf(step);
    const previousStep = stepOrder[index - 1];
    if (previousStep) {
      setStep(previousStep);
    }
  }

  function restart() {
    setDraft(initialDraft);
    setPhoneInput('');
    setPhoneError(null);
    setSendState({ status: 'idle' });
    resetTurnstile();
    setStep('intro');
  }

  function addPhoneNumber(event?: FormEvent) {
    event?.preventDefault();

    try {
      const normalized = normalizePhoneNumber(phoneInput);
      if (draft.phoneNumbers.includes(normalized)) {
        setPhoneError('This recipient is already added.');
        return;
      }
      if (draft.phoneNumbers.length >= 3) {
        setPhoneError('Send to no more than three recipients at a time.');
        return;
      }
      updateDraft({ phoneNumbers: [...draft.phoneNumbers, normalized] });
      setPhoneInput('');
      setPhoneError(null);
    } catch (error) {
      setPhoneError(error instanceof Error ? error.message : 'Enter a valid phone number.');
    }
  }

  function removePhoneNumber(phoneNumber: string) {
    updateDraft({ phoneNumbers: draft.phoneNumbers.filter((candidate) => candidate !== phoneNumber) });
  }

  async function sendNotification() {
    if (!apiClient || !runtime.config) {
      setSendState({ status: 'error', message: 'Application configuration is invalid.' });
      return;
    }

    const validation = validateNotificationDraft(draft);
    if (!validation.valid) {
      setSendState({ status: 'error', message: validation.reason });
      return;
    }

    if (!templateCatalog) {
      setSendState({ status: 'error', message: 'Message templates are still loading. Try again shortly.' });
      return;
    }

    if (!turnstileToken) {
      setSendState({ status: 'error', message: 'Complete human verification before sending.' });
      return;
    }

    setSendState({ status: 'sending' });
    try {
      const response = await apiClient.sendNotification({
        phoneNumbers: draft.phoneNumbers,
        templateType: draft.exposureType,
        tone: draft.tone,
        captchaToken: turnstileToken,
        deviceHash: await getDeviceHash(),
        idempotencyKey: crypto.randomUUID()
      });
      if (response.status === 'partial_failed') {
        resetTurnstile();
        setSendState({
          status: 'error',
          message: `${response.sentCount} notification request accepted and ${response.failedCount} failed. Do not retry until support reviews the request reference: ${response.requestId}.`
        });
        return;
      }
      setSendState({ status: 'sent', requestId: response.requestId });
      setStep('sent');
    } catch (error) {
      if (error instanceof PartnerNotifyApiError && ['CAPTCHA_FAILED', 'CAPTCHA_EXPIRED'].includes(error.code)) {
        resetTurnstile();
      }
      setSendState({
        status: 'error',
        message: error instanceof Error ? error.message : 'The notification could not be sent.'
      });
    }
  }

  return (
    <div className={`app-shell ${isKiosk ? 'kiosk-shell' : ''}`}>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Let Them Know home">
          <span className="brand-mark">
            <ShieldCheck size={22} />
          </span>
          <span>Let Them Know</span>
        </a>
        <div className="mode-toggle" aria-label="Mode selection">
          <button className={mode === 'public' ? 'active' : ''} onClick={() => setMode('public')}>
            <MonitorSmartphone size={16} />
            Public
          </button>
          <button className={mode === 'kiosk' ? 'active' : ''} onClick={() => setMode('kiosk')}>
            <Hospital size={16} />
            Clinic kiosk
          </button>
        </div>
      </header>

      <main className="workspace">
        <aside className="context-panel">
          <ModeSummary mode={mode} />
          <div className="assurance-list">
            <Assurance icon={<LockKeyhole size={18} />} title="No account" text="The flow starts immediately." />
            <Assurance icon={<ClipboardCheck size={18} />} title="Fixed templates" text="No free-form SMS content." />
            <Assurance icon={<UserRoundCheck size={18} />} title="Manual entry" text="No contact-book permission." />
          </div>
          {isKiosk ? <KioskOperatorNotes /> : <PublicAccessNotes />}
        </aside>

        <section className="flow-panel" aria-live="polite">
          {step !== 'intro' && step !== 'sent' ? <ProgressRail progress={progress} step={step} /> : null}
          {step === 'intro' ? (
            <IntroStep mode={mode} onStart={() => setStep('consent')} />
          ) : null}
          {step === 'consent' ? (
            <ConsentStep draft={draft} updateDraft={updateDraft} onNext={next} onBack={back} />
          ) : null}
          {step === 'exposure' ? (
            <ExposureStep draft={draft} updateDraft={updateDraft} preview={preview} onNext={next} onBack={back} />
          ) : null}
          {step === 'recipients' ? (
            <RecipientsStep
              draft={draft}
              phoneInput={phoneInput}
              phoneError={phoneError}
              setPhoneInput={setPhoneInput}
              addPhoneNumber={addPhoneNumber}
              removePhoneNumber={removePhoneNumber}
              onNext={next}
              onBack={back}
            />
          ) : null}
          {step === 'review' ? (
            <ReviewStep
              draft={draft}
              preview={preview}
              sendState={sendState}
              templatesLoaded={templateCatalog !== null}
              templateError={templateError}
              turnstileToken={turnstileToken}
              turnstileError={turnstileError}
              turnstileSiteKey={runtime.config!.turnstileSiteKey}
              turnstileResetSignal={turnstileResetSignal}
              setTurnstileToken={handleTurnstileToken}
              setTurnstileError={setTurnstileError}
              onSend={sendNotification}
              onBack={back}
            />
          ) : null}
          {step === 'sent' && sendState.status === 'sent' ? (
            <SentStep requestId={sendState.requestId} mode={mode} restart={restart} />
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ModeSummary({ mode }: { mode: AppMode }) {
  if (mode === 'kiosk') {
    return (
      <div className="mode-summary">
        <Hospital size={28} />
        <h1>Clinic kiosk mode</h1>
          <p>
          A tablet flow for clinics, health events, and visit follow-up. Staff can help people use
          it before they leave.
          </p>
      </div>
    );
  }

  return (
    <div className="mode-summary">
      <HeartPulse size={28} />
      <h1>Let Them Know</h1>
      <p>
        Send a public-health partner notification when someone may need testing.
      </p>
    </div>
  );
}

function IntroStep({ mode, onStart }: { mode: AppMode; onStart: () => void }) {
  return (
    <div className="step intro-step">
      <div className="hero-symbol">
        {mode === 'kiosk' ? <Hospital size={52} /> : <MessageSquareText size={52} />}
      </div>
      <div>
        <h2>{mode === 'kiosk' ? 'Start a clinic tablet session.' : 'Send a private STI health message.'}</h2>
        <p>
          This service sends approved health messages only. It helps people send a clear message
          while keeping consent and misuse checks in place.
        </p>
      </div>
      <div className="intro-grid">
        <SmallStat label="Typical time" value="90 sec" />
        <SmallStat label="Recipients" value="1-3" />
        <SmallStat label="Message body" value="Fixed" />
      </div>
      <button className="primary-action" onClick={onStart}>
        Start
        <ArrowRight size={20} />
      </button>
    </div>
  );
}

function ConsentStep({
  draft,
  updateDraft,
  onNext,
  onBack
}: {
  draft: NotificationDraft;
  updateDraft: (update: Partial<NotificationDraft>) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const canContinue = draft.consentExposure && draft.consentNoHarassment;

  return (
    <div className="step">
      <StepHeading title="Before you send" text="Do not use this for threats, jokes, getting back at someone, or false reports." />
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.consentExposure}
          onChange={(event) => updateDraft({ consentExposure: event.target.checked })}
        />
        <span>I understand this is for telling someone they may have been exposed to an STI.</span>
      </label>
      <label className="check-row">
        <input
          type="checkbox"
          checked={draft.consentNoHarassment}
          onChange={(event) => updateDraft({ consentNoHarassment: event.target.checked })}
        />
        <span>I will not use this to harass someone or send a false notification.</span>
      </label>
      <StepActions onBack={onBack} onNext={onNext} nextDisabled={!canContinue} />
    </div>
  );
}

function ExposureStep({
  draft,
  updateDraft,
  preview,
  onNext,
  onBack
}: {
  draft: NotificationDraft;
  updateDraft: (update: Partial<NotificationDraft>) => void;
  preview: string;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step">
      <StepHeading title="Choose what the message is about" text="The person gets a clear health message. It does not say they have an STI." />
      <div className="option-grid">
        {exposureOptions.map((option) => (
          <button
            key={option.value}
            className={`option-card ${draft.exposureType === option.value ? 'selected' : ''}`}
            onClick={() => updateDraft({ exposureType: option.value })}
          >
            <span>{option.label}</span>
            <small>{option.description}</small>
            {draft.exposureType === option.value ? <Check size={18} /> : null}
          </button>
        ))}
      </div>
      <div className="tone-row" role="radiogroup" aria-label="Message tone">
        {toneOptions.map((tone) => (
          <button
            key={tone.value}
            className={draft.tone === tone.value ? 'active' : ''}
            onClick={() => updateDraft({ tone: tone.value })}
          >
            {tone.label}
          </button>
        ))}
      </div>
      <MessagePreview exposureType={draft.exposureType} tone={draft.tone} preview={preview} />
      <StepActions onBack={onBack} onNext={onNext} />
    </div>
  );
}

function RecipientsStep({
  draft,
  phoneInput,
  phoneError,
  setPhoneInput,
  addPhoneNumber,
  removePhoneNumber,
  onNext,
  onBack
}: {
  draft: NotificationDraft;
  phoneInput: string;
  phoneError: string | null;
  setPhoneInput: (value: string) => void;
  addPhoneNumber: (event?: FormEvent) => void;
  removePhoneNumber: (phoneNumber: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  return (
    <div className="step">
      <StepHeading title="Add phone numbers" text="Type phone numbers by hand. The web app does not ask to see your contacts." />
      <form className="phone-form" onSubmit={addPhoneNumber}>
        <div>
          <label htmlFor="phone">Phone number</label>
          <input
            id="phone"
            inputMode="tel"
            autoComplete="tel"
            value={phoneInput}
            onChange={(event) => setPhoneInput(event.target.value)}
            placeholder="(203) 555-1234"
          />
        </div>
        <button type="submit" aria-label="Add phone number">
          <Plus size={20} />
        </button>
      </form>
      {phoneError ? <p className="form-error">{phoneError}</p> : null}
      <div className="recipient-list">
        {draft.phoneNumbers.map((phoneNumber) => (
          <div className="recipient-row" key={phoneNumber}>
            <Phone size={18} />
            <span>{formatPhoneNumber(phoneNumber)}</span>
            <button onClick={() => removePhoneNumber(phoneNumber)} aria-label={`Remove ${formatPhoneNumber(phoneNumber)}`}>
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <StepActions onBack={onBack} onNext={onNext} nextDisabled={draft.phoneNumbers.length === 0} />
    </div>
  );
}

function ReviewStep({
  draft,
  preview,
  sendState,
  templatesLoaded,
  templateError,
  turnstileToken,
  turnstileError,
  turnstileSiteKey,
  turnstileResetSignal,
  setTurnstileToken,
  setTurnstileError,
  onSend,
  onBack
}: {
  draft: NotificationDraft;
  preview: string;
  sendState: SendState;
  templatesLoaded: boolean;
  templateError: string | null;
  turnstileToken: string;
  turnstileError: string | null;
  turnstileSiteKey: string;
  turnstileResetSignal: number;
  setTurnstileToken: (token: string) => void;
  setTurnstileError: (message: string) => void;
  onSend: () => void;
  onBack: () => void;
}) {
  const sendDisabled = isSendDisabled(draft, turnstileToken, sendState.status === 'sending', templatesLoaded);

  return (
    <div className="step">
      <StepHeading title="Check before sending" text="You choose the type of message. The system sends only approved text." />
      <div className="review-stack">
        <MessagePreview exposureType={draft.exposureType} tone={draft.tone} preview={preview} />
        <div className="review-box">
          <h3>Recipients</h3>
          {draft.phoneNumbers.map((phoneNumber) => (
            <p key={phoneNumber}>{formatPhoneNumber(phoneNumber)}</p>
          ))}
        </div>
      </div>
      <div className="verification-panel">
        <strong>Human verification</strong>
        <TurnstileChallenge
          siteKey={turnstileSiteKey}
          resetSignal={turnstileResetSignal}
          onToken={setTurnstileToken}
          onError={setTurnstileError}
        />
      </div>
      {templateError ? <p className="form-error">{templateError}</p> : null}
      {!templatesLoaded ? <p className="form-note">Loading approved message text.</p> : null}
      {turnstileError ? <p className="form-error">{turnstileError}</p> : null}
      {sendState.status === 'error' ? <p className="form-error">{sendState.message}</p> : null}
      <div className="action-row">
        <button className="secondary-action" onClick={onBack}>
          <ArrowLeft size={18} />
          Back
        </button>
        <button className="primary-action" onClick={onSend} disabled={sendDisabled}>
          {sendState.status === 'sending' ? 'Sending' : 'Send notification'}
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}

function SentStep({ requestId, mode, restart }: { requestId: string; mode: AppMode; restart: () => void }) {
  return (
    <div className="step sent-step">
      <CheckCircle2 size={62} />
      <h2>Message request accepted</h2>
      <p>
        {mode === 'kiosk'
          ? 'Clear the tablet before the next person uses it.'
          : 'The service accepted the request.'}
      </p>
      <code>{requestId}</code>
      <div className="action-row">
        <a className="secondary-action" href={testingLocatorUrl} target="_blank" rel="noreferrer">
          Find testing
          <ExternalLink size={18} />
        </a>
        <button className="primary-action" onClick={restart}>
          Start another
          <RotateCcw size={18} />
        </button>
      </div>
    </div>
  );
}

function ProgressRail({ progress, step }: { progress: number; step: Step }) {
  return (
    <div className="progress-wrap" aria-label={`Current step ${step}`}>
      <div className="progress-label">
        <span>{step.replace('-', ' ')}</span>
        <span>{Math.round(progress * 100)}%</span>
      </div>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

function StepHeading({ title, text }: { title: string; text: string }) {
  return (
    <div className="step-heading">
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

function StepActions({
  onBack,
  onNext,
  nextDisabled = false
}: {
  onBack: () => void;
  onNext: () => void;
  nextDisabled?: boolean;
}) {
  return (
    <div className="action-row">
      <button className="secondary-action" onClick={onBack}>
        <ArrowLeft size={18} />
        Back
      </button>
      <button className="primary-action" onClick={onNext} disabled={nextDisabled}>
        Next
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

function MessagePreview({
  exposureType,
  tone,
  preview
}: {
  exposureType: ExposureType;
  tone: MessageTone;
  preview: string;
}) {
  return (
    <div className="message-preview">
      <div>
        <MessageSquareText size={18} />
        <strong>Message preview</strong>
      </div>
      <p>{preview || 'Loading approved message text.'}</p>
      <small>
        {exposureType} / {tone}
      </small>
    </div>
  );
}

function Assurance({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="assurance-item">
      {icon}
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="small-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PublicAccessNotes() {
  return (
    <div className="note-panel">
      <h2>Best adoption path</h2>
      <p>Use this from QR codes in clinic instructions, lab portals, outreach materials, and public health pages.</p>
    </div>
  );
}

function KioskOperatorNotes() {
  return (
    <div className="note-panel">
      <h2>Staff workflow</h2>
      <ol>
        <li>Explain the session purpose.</li>
        <li>Hand the tablet to the patient.</li>
        <li>Confirm the success screen clears before reuse.</li>
      </ol>
    </div>
  );
}

function StaticPage({
  title,
  body,
  action
}: {
  title: string;
  body: string[];
  action?: { href: string; label: string };
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Let Them Know home">
          <span className="brand-mark">
            <ShieldCheck size={22} />
          </span>
          <span>Partner Notify</span>
        </a>
      </header>
      <main className="static-page">
        <h1>{title}</h1>
        {body.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        {action ? (
          <a className="primary-action static-action" href={action.href} target="_blank" rel="noreferrer">
            {action.label}
            <ExternalLink size={18} />
          </a>
        ) : null}
        <div className="static-links">
          <a href="/testing">Find testing</a>
          <a href="/privacy">Privacy</a>
          <a href="/support">Support</a>
          <a href="/report-abuse">Report abuse</a>
        </div>
      </main>
    </div>
  );
}

function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy"
      body={[
        'Partner Notify sends prewritten public-health messages to manually entered phone numbers. It does not request contacts, accounts, location, photos, diagnosis records, or free-text message content.',
        'The notification API receives recipient phone numbers only to deliver the message. Operational controls use hashed recipient values, device hashes, request IDs, template metadata, and provider status records.',
        'Operators should retain request metadata only as long as needed for abuse prevention, delivery support, and legal compliance.'
      ]}
    />
  );
}

function SupportPage() {
  return (
    <StaticPage
      title="Support"
      body={[
        'Partner Notify is a constrained partner notification tool. A message means someone reported a possible exposure; it does not diagnose you or prove that you have an infection.',
        'Consider testing or contacting a health care provider or local health department. For nearby testing locations, use the testing page or visit gettested.cdc.gov.',
        'If you received a harmful, threatening, or false notification, use the abuse reporting page so the operator can review and block misuse.'
      ]}
    />
  );
}

export function TestingPage() {
  return (
    <StaticPage
      title="Find STI testing"
      body={[
        'Use the CDC GetTested locator to find nearby STI, HIV, and viral hepatitis testing services in the United States and its territories.',
        'The locator may ask for your ZIP code or location in your browser. Partner Notify does not receive or store that location search.',
        'If you have symptoms, a known exposure, or urgent concerns, contact a health care provider or local health department directly.'
      ]}
      action={{ href: testingLocatorUrl, label: 'Open CDC testing locator' }}
    />
  );
}

function ReportAbusePage() {
  return (
    <StaticPage
      title="Report abuse"
      body={[
        'Use this route to report harassment, threats, repeated unwanted notifications, or suspected false use of Partner Notify.',
        'Include the date, approximate time, recipient phone number, and the request reference if one was provided. Do not include medical records or unnecessary personal details.',
        'Production operators must connect this page to a monitored abuse inbox or intake form before public launch.'
      ]}
    />
  );
}
