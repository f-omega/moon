# Moon: RDF Knowledge base tool

Moon is a tool for viewing and editing RDF knowledge bases. You
provide a link to a SPARQL endpoint and (optionally) a SPARQL update
endpoint, and moon lets you browse RDF entities, alter them or add and
create new ones.

## SHACL / DASH Support

Moon also supports (perhaps partially) the following standards:

* [SHACL](https://www.w3.org/TR/shacl/)
* [SHACL Advanced](https://w3c.github.io/shacl/shacl-af/) (partial)
* [DASH](https://datashapes.org/dash.html)
* [VOID](https://www.w3.org/TR/void/) -- For describing SPARQL endpoints for particular datasets
* [SPARQL Service Description](https://www.w3.org/TR/sparql11-service-description/)
* [Form generation using SHACL and DASH](https://www.datashapes.org/forms.html)

## Status

Moon is currently alpha software. Be very careful using the update
functionality in production. Please review any SPARQL generated before
execution

## Moon as a Content management system

Given a set of markdown or HTML templates, moon can also be used as an
on-demand static website generator. Moon can generate pages directly
from entities in your knowledge graph and serve them via
HTTP. Optional caching (via varnish) will soon be added. This lets you
use the moon edit service to edit highly structured data and then
publish it for public consumption.

# Running

Moon can be run via docker, or in development mode. To run in
development mode `cd` to the downloaded directory, and run:

```bash
yarn build-server && yarn start-server -c <configfile>
```

To run in Docker, use the pre-built image (`fomega/moon`) or execute

```bash
docker build . -t moon  # alternatively: docker -> podman
```

Then invoke with

```bash
docker run -v <config>:/config moon server.js -c /config
```

# Configuration

Moon is configured using a simple RDF file. The configuration file can
be in any format supported by the
[rdf-parse](https://github.com/rubensworks/rdf-parse.js] package (N3
is recommended for now, but RDF/XML also works).

Here is an example configuration:

```n3
@prefix : <myservice>.
#prefix moon: <https://ld.f-omega.com/moon/>.

# Each moon endpoint is a separate instance of a moon:EditService or moon:ContentService

# An edit service lets you view and edit RDF data

:EditService a moon:EditService
  moon:servicePort 3000;
  moon:dataset <dataset.ttl>.

# A content service creates a static website from your data

<mydomain> a moon:ContentService;
  moon:servicePort 3080;
  moon:content <url/to/folder/containing/templates>;
  moon:dataset <dataset.ttl>
```

The `moon:dataset` property links each service to a VoID description
of the dataset(s) to serve.

For example,

```n3
@prefix void: <http://rdfs.org/ns/void#>.
@prefix sd: <http://www.w3.org/ns/sparql-service-description#>.
@prefix dcterms: <http://purl.org/dc/terms/>.

# each dataset in this file is made available in the edit service and content service

:MyDataset a void:Dataset;
  dcterms:title "Name of dataset";  # This appears in the dataset selection box in the EditService

  # sd:Service descriptions of endpoints used to access this dataset.
  #
  # Multiple services can be listed, in which case they are chosen arbitrarily.
  #
  # Service should list their supported languages. If the service is
  # listed as supporting updates, the endpoint will be used for update
  # queries.
  void:sparqlEndpoint <sparqlEndpoint>.

# The following endpoint would be used for SELECT and DESCRIBE queries
<sparqlEndpoint> a sd:Service;
  sd:endpoint <http://sparql.mydomain.com/dataset>;
  sd:supportedLanguage sd:SPARQL11Query, sd:SPARQL10Query.

<updateEnpoint> a sd:Service;
  sd:endpoint <http://sparql.mydomain.com/dataset/update>;
  sd:supportedLanguage sd:SPARQL11QUpdate.
```

## Advanced Configuration

### SPARQL proxy service

The JavaScript interface normally connects directly to your SPARQL
service using the HTTP protocol. This is efficient and reduces the
moon server load. However, sometimes your SPARQL endpoints are not
accessible to the same audience as your moon server. Or, if they are,
it may be difficult to configure CORs or other security policies to
make them accessible via the web.

Moon supports proxying requests from Moon clients to the underlying
SPARQL server. To enable this, simple set the `moon:proxy` property on
the `sd:Service` description to true. Any queries from the client to
this endpoint will now be proxied through the moon service.

Example:

```n3
# The following endpoint would be used for SELECT and DESCRIBE queries
<sparqlEndpoint> a sd:Service;
  sd:endpoint <http://sparql.mydomain.com/dataset>;
  sd:supportedLanguage sd:SPARQL11Query, sd:SPARQL10Query;
  moon:proxy true.   # This causes the moon API server to proxy SPARQL queries and updates
```

### SPARQL update credentials

Some SPARQL update services are protected with HTTP
authentication. Currently, moon fully supports Basic authentication
(more to come later). If you attempt to send an update query that
fails due to lacking authentication, the moon UI will prompt for a
username/password. You can elide this request by supplying the
password in a `moon:credentials` property to the `sd:Service`. You can
also only provide the username, which will cause the UI to request the
password whenever an update is made.

Example:

```n3
<updateEnpoint> a sd:Service;
  sd:endpoint <http://sparql.mydomain.com/dataset/update>;
  sd:supportedLanguage sd:SPARQL11QUpdate;
  moon:credentials [ a moon:BasicCredentials;
    moon:username "sparqluser";
    moon:password "sparqlpassword" ]. # Can leave out moon:password to be prompted in the UI
```

Note that if you supply a password and you don't use proxying the
password will be sent over the wire to the client, so please make sure
moon is behind an HTTPS reverse proxy.

# Content service

The content service is enabled by adding a `moon:ContentService`
description to the configuration file. The content service expects a
file containing the content you want to serve statically. Currently,
HTML and Markdown files are supported.

Each file in your content directory corresponds to some type of
content you wish to serve. We use a jinja like templating language and
the nunjucks javascript library. Please refer to [their
documentation](https://mozilla.github.io/nunjucks/templating.html) for
the basic syntax and structure of templates.

Each file should begin with 'front matter'. This is a simple section
enclosed in lines containing just `---` that contains meta information
in YAML format.

At the very least the front matter must contain a `urlpattern` and `target` key.

Example:

```
---
urlpattern: /kb/state/(?<state>[a-z]{2})/city/(?<city>[^/]*)
target: https://geoservice.com/state/{state}/city/{city}
---
```

When the content service sees this file, it redirects any request to
anything matching the given urlpattern regex to the target RDF
entity. The entity is fetched (including subproperties) and made
available to the template (based on the SHACL shape description). In
particular a request to `/kb/state/ca/city/los-angeles` will cause
moon to generate content based on
`https://geoservice.com/state/ca/city/los-angeles`.


