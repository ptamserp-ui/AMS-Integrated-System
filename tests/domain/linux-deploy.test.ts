import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const scriptPath = path.join(process.cwd(), 'deploy-linux.ps1');
const guidePath = path.join(process.cwd(), 'docs', 'panduan-deploy-vps.md');

describe('Deploy Linux melalui SSH', () => {
  const script = fs.readFileSync(scriptPath, 'utf8');
  const guide = fs.readFileSync(guidePath, 'utf8');

  it('menyediakan deploy terkonfirmasi dan dry-run tanpa operasi VPS', () => {
    expect(script).toContain('[CmdletBinding(SupportsShouldProcess = $true');
    expect(script).toContain('StrictHostKeyChecking=yes');
    expect(script).toContain('BatchMode=yes');
    expect(script).toContain('if (-not $PSCmdlet.ShouldProcess(');
    expect(guide).toContain('.\\deploy-linux.ps1');
    expect(guide).toContain('-WhatIf');
  });

  it('hanya mengupdate branch fast-forward yang bersih dan menguji mode target', () => {
    expect(script).toContain('git status --porcelain');
    expect(script).toContain('git fetch --prune "$REMOTE_NAME" "$BRANCH"');
    expect(script).toContain('git pull --ff-only "$REMOTE_NAME" "$BRANCH"');
    expect(script).toContain('npm ci');
    expect(script).toContain('npm run lint');
    expect(script).toContain('npm test -- --mode "$DEPLOYMENT_ENV"');
    expect(script).toContain('npm run "build:$DEPLOYMENT_ENV"');
    expect(script).not.toMatch(/git\s+(?:reset|clean)\b/);
    expect(script).not.toMatch(/--force|-Force|force-push/i);
  });

  it('memvalidasi target Firebase dan membatasi restart pada satu unit systemd', () => {
    expect(script).toContain('systemctl restart "$SERVICE_NAME"');
    expect(script.match(/systemctl restart/g)).toHaveLength(1);
    expect(script).toContain("[ValidatePattern('^ams(?:-[A-Za-z0-9_.-]+)?(?:\\.service)?$')]");
    expect(script).toContain('[ValidatePattern(\'^ams$\')]');
    expect(script).toContain('[ValidatePattern(\'^/opt/ams/app$\')]');
    expect(script).toContain('if [[ "$service_user" != "$APP_USER" ]]; then');
    expect(script).toContain('readyForStableConnection === true');
    expect(script).toContain('admin?.connected === true');
    expect(script).toContain('EXPECTED_DATABASE_ID');
    expect(script).not.toMatch(/\b(?:ufw\s+(?:allow|enable)|nginx\s+-t|systemctl\s+(?:restart|stop)\s+(?:nginx|caddy))/i);
    expect(script).not.toMatch(/systemctl\s+(?:restart|stop)\s+(?!"\$SERVICE_NAME")/);
  });
});
