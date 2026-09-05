import test from 'node:test';
import assert from 'node:assert/strict';
import { getPublicAcademicWorks } from '../academic-works-publications.ts';

const previousEdital = {
  titulo: 'Edital Trabalhos COEPS - 2025',
  link: 'https://example.com/coeps-2025.pdf',
};

const currentEdital = {
  titulo: 'Edital Trabalhos científicos - I CIEPS',
  link: 'https://example.com/i-cieps.pdf',
};

test('hides the previous COEPS edital and preserves the current I CIEPS publication', () => {
  const result = getPublicAcademicWorks({
    link_edital: previousEdital.link,
    resultados: [previousEdital, currentEdital],
  });

  assert.deepEqual(result.publications, [currentEdital]);
  assert.equal(result.editalLink, currentEdital.link);
});

test('preserves a configured edital when it is not the previous COEPS publication', () => {
  const result = getPublicAcademicWorks({
    link_edital: currentEdital.link,
    resultados: [previousEdital, currentEdital],
  });

  assert.deepEqual(result.publications, [currentEdital]);
  assert.equal(result.editalLink, currentEdital.link);
});
