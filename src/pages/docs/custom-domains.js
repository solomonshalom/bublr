/** @jsxImportSource @emotion/react */
import Link from 'next/link'
import Head from 'next/head'
import { css, Global } from '@emotion/react'

import SiteFooter from '../../components/site-footer'
import meta from '../../components/meta'
import { PRO_PLAN } from '../../lib/pricing'
import { PAYMENT_GRACE_DAYS } from '../../lib/subscription'
import { proSurface, proButton, DomainMorph, SparkleIcon } from '../../components/pro/pro-look'

const globalStyles = css`
  @import url('https://fonts.bunny.net/css?family=inter:400,500,600&family=jetbrains-mono:400');
`

const DASHBOARD = '/dashboard/settings/domain'

const h2 = css`
  font-weight: 500;
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--grey-5);
`

const body = css`
  color: var(--grey-3);
  margin-top: 12px;
  line-height: 1.7;
`

const rule = css`
  opacity: 0.15;
  margin: 32px 0;
  border-color: var(--grey-4);
`

const dotted = css`
  border-bottom: 1px dotted var(--grey-3);
  text-decoration: none;
`

const Code = ({ children }) => (
  <code
    css={css`
      background: var(--code-bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9em;
    `}
  >
    {children}
  </code>
)

function RecordTable({ rows }) {
  return (
    <div css={css`overflow-x: auto; margin-top: 12px;`}>
      <table
        css={css`
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          color: var(--grey-4);

          th,
          td {
            text-align: left;
            padding: 8px 10px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
          }

          th {
            font-weight: 500;
            color: var(--grey-3);
            font-size: 12px;
          }

          td:nth-of-type(2),
          td:nth-of-type(3) {
            font-family: 'JetBrains Mono', monospace;
          }
        `}
      >
        <thead>
          <tr>
            <th>Type</th>
            <th>Name</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.join('|')}>
              {row.map(cell => (
                <td key={cell}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Faq({ q, children }) {
  return (
    <div css={css`margin-top: 20px;`}>
      <p css={css`font-weight: 500; color: var(--grey-4);`}>{q}</p>
      <p css={css`color: var(--grey-3); margin-top: 6px; line-height: 1.7;`}>{children}</p>
    </div>
  )
}

export default function CustomDomainDocs() {
  return (
    <>
      <Global styles={globalStyles} />
      <Head>
        {meta({
          title: `Custom Domains with ${PRO_PLAN.name} | Bublr Docs`,
          description: `Put your Bublr profile and posts on your own domain for ${PRO_PLAN.priceLabel}. Root domains and subdomains, automatic HTTPS, cancel anytime.`,
          url: '/docs/custom-domains',
        })}
        <link rel="canonical" href="https://bublr.life/docs/custom-domains" />
      </Head>

      <div
        css={css`
          font-family: Inter, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: var(--grey-4);
          background-color: var(--grey-1);
          min-height: 100vh;

          *, ::after, ::before {
            box-sizing: border-box;
          }

          a {
            color: inherit;
          }
        `}
      >
        <section css={css`padding: 1.5rem 0; @media (min-width: 992px) { padding: 3rem; }`}>
          <div css={css`max-width: 700px; width: 100%; padding: 0 0.75rem; margin: 0 auto;`}>
            <div css={css`padding: 1.5rem; @media (min-width: 992px) { padding: 3rem; }`}>
              <Link href="/" passHref>
                <a css={css`text-decoration: none; font-size: 2rem;`}>🍱</a>
              </Link>

              <p css={css`color: var(--grey-3); margin-top: 32px; font-size: 12px;`}>
                <Link href="/docs" passHref><a css={dotted}>Docs</a></Link>
                {' → Custom Domains'}
              </p>

              <h1 css={css`font-size: 1.25rem; font-weight: 500; margin: 12px 0 8px; line-height: 1.2;`}>
                Use your own domain
              </h1>
              <p css={css`color: var(--grey-3); margin-bottom: 28px;`}>
                {PRO_PLAN.name} · {PRO_PLAN.priceLabel} · cancel anytime
              </p>

              <div css={[proSurface, css`border-radius: 14px; padding: 1.4rem 1.3rem; box-shadow: 0 18px 40px -24px rgba(140, 45, 0, 0.8);`]}>
                <p css={css`display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 600; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.92;`}>
                  <SparkleIcon size={11} /> {PRO_PLAN.name}
                </p>
                <p css={css`font-size: 1.2rem; font-weight: 600; margin: 8px 0 14px; color: #fff; line-height: 1.3;`}>
                  Your writing, at your own address.
                </p>
                <DomainMorph username="yourname" />
                <div css={css`display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 18px;`}>
                  <p>
                    <span css={css`font-size: 1.6rem; font-weight: 700;`}>{PRO_PLAN.price}</span>
                    <span css={css`opacity: 0.9;`}> / month</span>
                  </p>
                  <Link href={DASHBOARD} passHref>
                    <a css={proButton}>Get {PRO_PLAN.name} →</a>
                  </Link>
                </div>
              </div>

              <hr css={rule} />

              <p css={h2}>What you get</p>
              <ul css={css`color: var(--grey-3); margin: 12px 0 0 1.25rem; line-height: 1.9;`}>
                {PRO_PLAN.features.map(feature => (
                  <li key={feature}>{feature}</li>
                ))}
                <li>Your old bublr.life links keep working, and search engines are told your domain is the main address</li>
              </ul>

              <hr css={rule} />

              <p css={h2}>Set it up in four steps</p>
              <ol css={css`color: var(--grey-3); margin: 12px 0 0 1.25rem; line-height: 1.9;`}>
                <li>
                  Open <Link href={DASHBOARD} passHref><a css={dotted}>Dashboard → Custom domain</a></Link> and subscribe ({PRO_PLAN.priceLabel}).
                </li>
                <li>Type your domain and click <strong>Connect domain</strong>. A root domain (<Code>yourname.com</Code>) or a subdomain (<Code>blog.yourname.com</Code>) both work.</li>
                <li>Add the DNS record(s) the dashboard shows at the place you manage your domain (your registrar or DNS host).</li>
                <li>That’s it. We check automatically and your site goes live on its own, with HTTPS, usually within minutes.</li>
              </ol>

              <p css={body}>The records look like this — always copy the exact values from your dashboard, they can differ:</p>
              <p css={css`margin-top: 16px; font-weight: 500; color: var(--grey-4);`}>Root domain (yourname.com)</p>
              <RecordTable rows={[['A', '@', '76.76.21.21'], ['CNAME', 'www', 'cname.vercel-dns.com']]} />
              <p css={body}>
                The <Code>www</Code> record is optional — add it and <Code>www.yourname.com</Code> forwards to <Code>yourname.com</Code>.
              </p>
              <p css={css`margin-top: 16px; font-weight: 500; color: var(--grey-4);`}>Subdomain (blog.yourname.com)</p>
              <RecordTable rows={[['CNAME', 'blog', 'cname.vercel-dns.com']]} />
              <p css={body}>
                If the domain was used on another site before, you may also be asked for a <Code>TXT</Code> record named{' '}
                <Code>_vercel</Code> to prove it’s yours. The dashboard shows it when it’s needed.
              </p>

              <hr css={rule} />

              <p css={h2}>Tips for popular DNS providers</p>
              <ul css={css`color: var(--grey-3); margin: 12px 0 0 1.25rem; line-height: 1.9;`}>
                <li><strong>Cloudflare:</strong> turn the orange cloud off (<em>DNS only</em>) for these records.</li>
                <li><strong>Namecheap, Porkbun, GoDaddy:</strong> use <Code>@</Code> for the root and just <Code>blog</Code> (not the full name) for a subdomain.</li>
                <li><strong>Squarespace / Google Domains:</strong> add the records under <em>DNS → Custom records</em>.</li>
                <li>Remove any other A, AAAA or CNAME record on the same name, or readers may land on your old site.</li>
                <li>Your email (MX records) isn’t affected. Only add the records we list.</li>
              </ul>

              <hr css={rule} />

              <p css={h2}>Questions</p>
              <Faq q="Do I need to buy a domain first?">
                Yes. Buy one from any registrar (Namecheap, Porkbun, Cloudflare, GoDaddy…), or use one you already own. Bublr doesn’t sell domains.
              </Faq>
              <Faq q="What happens if I cancel?">
                Your domain keeps working until the end of the month you’ve paid for, and you can resume any time before then. After that,
                readers who visit your domain are sent to your bublr.life page. Nothing is deleted — resubscribe and it’s all back.
              </Faq>
              <Faq q="What if a payment fails?">
                We email you and your domain stays online for {PAYMENT_GRACE_DAYS} days while you update your card from the dashboard.
              </Faq>
              <Faq q="Can I change domains later?">
                Yes — click <strong>Change</strong> on the Custom domain page. The old domain is disconnected for you.
              </Faq>
              <Faq q={'It says the domain is “connected to another Vercel project”.'}>
                The domain is still attached to another site hosted on Vercel. Remove it from that project (or ask whoever runs it to), then
                connect it here again.
              </Faq>
              <Faq q="How do I pay, and can I get an invoice?">
                Checkout and billing are handled securely by Dodo Payments, priced in USD (local taxes may be added). Download invoices,
                update your card or cancel from <strong>Billing &amp; invoices</strong> on the Custom domain page.
              </Faq>

              <SiteFooter current="/docs/custom-domains" />
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
