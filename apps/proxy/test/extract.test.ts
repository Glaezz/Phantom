import { PageFeaturesSchema } from '@phantom/core';
import { describe, expect, it } from 'vitest';
import { extractFeatures } from '../src/net/extractFeatures';

describe('extractFeatures', () => {
  it('extracts a login form and raw action', async () => {
    const features = await extractFeatures(
      `<!doctype html><html><head>
        <title>  Login   BCA  </title>
        <meta property="og:site_name" content="BCA">
        <link rel="stylesheet" href="https://cdn.other.com/app.css">
        <link rel="preload" href="https://cdn.other.com/font.woff">
      </head><body>
        <h1>Masuk <span>BCA</span></h1>
        <form action="/post" method="POST">
          <input name="user">
          <input type="password" name="pass">
          <input type="hidden" name="csrf">
        </form>
        <input name="otp">
        <img src="https://cdn.other.com/logo.png">
        <img src="/local.png">
        <script src="https://cdn.other.com/app.js"></script>
        <iframe src="https://other.com/frame"></iframe>
      </body></html>`,
      'https://login.example/page',
    );

    expect(features.title).toBe('Login BCA');
    expect(features.headings).toEqual(['Masuk BCA']);
    expect(features.siteName).toBe('BCA');
    expect(features.forms[0]).toMatchObject({
      action: '/post',
      method: 'post',
    });
    expect(features.forms[0].fields.map((field) => field.type)).toEqual(['text', 'password']);
    expect(features.forms[1]).toMatchObject({ action: null, method: 'post', detached: true });
    expect(features.forms[1].fields[0].name).toBe('otp');
    expect(features.externalResources.map((resource) => resource.url)).toEqual(
      expect.arrayContaining(['https://cdn.other.com/logo.png', 'https://cdn.other.com/app.js']),
    );
    expect(features.externalResources.some((resource) => resource.url.includes('/local.png'))).toBe(
      false,
    );
    expect(features.externalResources.some((resource) => resource.kind === 'iframe')).toBe(true);
    expect(features.externalResources.some((resource) => resource.kind === 'link')).toBe(true);
  });

  it('puts an input outside a form into a pseudo form', async () => {
    const features = await extractFeatures('<input type="password" name="pass">', 'https://a.example/');
    expect(features.forms).toHaveLength(1);
    expect(features.forms[0]).toMatchObject({ action: null, method: 'post', detached: true });
    expect(features.forms[0].fields[0].type).toBe('password');
  });

  it('does not throw on broken HTML and still validates', async () => {
    const features = await extractFeatures(
      '<title>Hi</title><form><input type=password name=pass',
      'https://a.example/',
    );
    expect(PageFeaturesSchema.safeParse(features).success).toBe(true);
  });
});
