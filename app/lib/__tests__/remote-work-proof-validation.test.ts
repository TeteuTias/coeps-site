import assert from 'node:assert/strict';
import test from 'node:test';
import { REMOTE_WORK_MAX_PROOF_BYTES } from '../remote-work-access.ts';
import {
    validateRemoteProofContent,
    validateRemoteProofEnvelope,
} from '../remote-work-proof-validation.ts';

test('aceita somente extensões suportadas até 10 MiB', () => {
    for (const name of ['conta.pdf', 'foto.jpg', 'foto.JPEG', 'arquivo.png']) {
        assert.equal(validateRemoteProofEnvelope({ name, size: REMOTE_WORK_MAX_PROOF_BYTES }).ok, true, name);
    }
    assert.equal(validateRemoteProofEnvelope({ name: 'conta.pdf', size: REMOTE_WORK_MAX_PROOF_BYTES + 1 }).ok, false);
    assert.equal(validateRemoteProofEnvelope({ name: 'conta.txt', size: 10 }).ok, false);
    assert.equal(validateRemoteProofEnvelope({ name: 'vazio.pdf', size: 0 }).ok, false);
});

test('exige que o MIME real corresponda à extensão', () => {
    assert.equal(validateRemoteProofContent('application/pdf', 'application/pdf').ok, true);
    assert.equal(validateRemoteProofContent('image/jpeg', 'image/jpeg').ok, true);
    assert.equal(validateRemoteProofContent('image/png', 'image/png').ok, true);
    assert.equal(validateRemoteProofContent('application/pdf', 'image/png').ok, false);
    assert.equal(validateRemoteProofContent('image/jpeg', 'application/octet-stream').ok, false);
});
