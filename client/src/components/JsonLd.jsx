// Schema.org JSON-LD (arama motorları için yapılandırılmış veri). "<" kaçırılır: script içinde erken kapanma olmaz.
export default function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\u003c') }} />;
}
