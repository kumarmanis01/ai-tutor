import { logger } from '@/lib/logger';
import React, { useEffect, useState } from 'react';

type AuditLog = {
  action: string;
  user?: { email: string };
  details: Record<string, unknown>;
  createdAt: string;
};

const AuditTrailViewer = () => {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    const fetchAuditLogs = async () => {
      try {
        const response = await fetch('/api/audit');
        if (response.ok) {
          const data: AuditLog[] = await response.json();
          setAuditLogs(data);
        } else {
          logger.error('Failed to fetch audit logs', { className: 'AuditTrailViewer', methodName: 'loadLogs' });
        }
      } catch (error) {
        logger.error('Error fetching audit logs', { className: 'AuditTrailViewer', methodName: 'loadLogs', error: String(error) });
      }
    };

    fetchAuditLogs();
  }, []);

  return (
    <div>
      <h1>Audit Trail Logs</h1>
      <ul>
        {auditLogs.map((log, index) => (
          <li key={index}>
            <strong>Action:</strong> {log.action} <br />
            <strong>User:</strong> {log.user?.email || 'Anonymous'} <br />
            <strong>Details:</strong> {JSON.stringify(log.details)} <br />
            <strong>Timestamp:</strong> {log.createdAt}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default AuditTrailViewer;
