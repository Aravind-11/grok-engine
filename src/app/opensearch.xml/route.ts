export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Grok Engine</ShortName>
  <Description>Search the web with Grok Engine</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Image width="16" height="16" type="image/x-icon">${origin}/favicon.ico</Image>
  <Url type="text/html" method="get" template="${origin}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" method="get" template="${origin}/api/suggest?q={searchTerms}"/>
</OpenSearchDescription>`;
  return new Response(xml, {
    headers: {
      "Content-Type": "application/opensearchdescription+xml; charset=utf-8",
    },
  });
}
