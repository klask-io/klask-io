import React, { useState, useEffect } from 'react';
import { ClockIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface CronScheduleFormProps {
  autoCrawlEnabled: boolean;
  cronSchedule?: string;
  crawlFrequencyHours?: number;
  maxCrawlDurationMinutes?: number;
  onScheduleChange: (schedule: {
    autoCrawlEnabled: boolean;
    cronSchedule?: string;
    crawlFrequencyHours?: number;
    maxCrawlDurationMinutes?: number;
  }) => void;
  className?: string;
}

const FREQUENCY_OPTIONS = [
  { value: 1, label: 'Every hour' },
  { value: 6, label: 'Every 6 hours' },
  { value: 12, label: 'Every 12 hours' },
  { value: 24, label: 'Daily' },
  { value: 168, label: 'Weekly (7 days)' },
] as const;

const DURATION_OPTIONS = [
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
] as const;

export const CronScheduleForm: React.FC<CronScheduleFormProps> = ({
  autoCrawlEnabled,
  cronSchedule,
  crawlFrequencyHours,
  maxCrawlDurationMinutes,
  onScheduleChange,
  className = '',
}) => {
  const [scheduleMode, setScheduleMode] = useState<'frequency' | 'cron'>(
    cronSchedule ? 'cron' : 'frequency'
  );
  const [localCronSchedule, setLocalCronSchedule] = useState(cronSchedule || '');
  const [localFrequency, setLocalFrequency] = useState(crawlFrequencyHours || 24);
  const [localDuration, setLocalDuration] = useState(maxCrawlDurationMinutes || 60);
  const [cronError, setCronError] = useState<string | null>(null);

  useEffect(() => {
    const scheduleData = {
      autoCrawlEnabled,
      maxCrawlDurationMinutes: localDuration,
      ...(scheduleMode === 'cron' 
        ? { cronSchedule: localCronSchedule, crawlFrequencyHours: undefined }
        : { crawlFrequencyHours: localFrequency, cronSchedule: undefined }
      ),
    };
    onScheduleChange(scheduleData);
  }, [autoCrawlEnabled, scheduleMode, localCronSchedule, localFrequency, localDuration, onScheduleChange]);

  const validateCronExpression = (cron: string): string | null => {
    if (!cron.trim()) return null;
    
    // Basic cron validation (should have 6 parts for seconds-based cron)
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 6) {
      return 'Cron expression must have 6 parts (seconds minutes hours day month weekday)';
    }

    // Additional basic validation could be added here
    const validParts = parts.every(part => {
      return /^[\d\*\-\,\/\?]+$/.test(part) || part === '?';
    });

    if (!validParts) {
      return 'Invalid characters in cron expression';
    }

    return null;
  };

  const handleCronChange = (value: string) => {
    setLocalCronSchedule(value);
    const error = validateCronExpression(value);
    setCronError(error);
  };

  const getNextRunDescription = () => {
    if (!autoCrawlEnabled) return null;

    if (scheduleMode === 'frequency') {
      return `Will run every ${localFrequency} hour${localFrequency !== 1 ? 's' : ''}`;
    } else if (localCronSchedule && !cronError) {
      return 'Will run according to cron schedule';
    }

    return null;
  };

  const getCommonCronExamples = () => [
    { expression: '0 0 */6 * * *', description: 'Every 6 hours' },
    { expression: '0 0 2 * * *', description: 'Daily at 2:00 AM' },
    { expression: '0 0 2 * * 1', description: 'Weekly on Monday at 2:00 AM' },
    { expression: '0 30 1 * * *', description: 'Daily at 1:30 AM' },
  ];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Auto-crawl Toggle */}
      <div className="flex items-center space-x-3">
        <input
          type="checkbox"
          id="autoCrawlEnabled"
          checked={autoCrawlEnabled}
          onChange={(e) => onScheduleChange({
            autoCrawlEnabled: e.target.checked,
            cronSchedule: scheduleMode === 'cron' ? localCronSchedule : undefined,
            crawlFrequencyHours: scheduleMode === 'frequency' ? localFrequency : undefined,
            maxCrawlDurationMinutes: localDuration,
          })}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
        />
        <label htmlFor="autoCrawlEnabled" className="text-sm font-medium text-gray-900">
          Enable automatic crawling
        </label>
      </div>

      {autoCrawlEnabled && (
        <>
          {/* Schedule Mode Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Schedule Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className={`relative flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                scheduleMode === 'frequency'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="frequency"
                  checked={scheduleMode === 'frequency'}
                  onChange={(e) => setScheduleMode('frequency')}
                  className="sr-only"
                />
                <div className="flex flex-col items-center space-y-1">
                  <ClockIcon className="h-5 w-5" />
                  <span className="text-xs font-medium">Simple Frequency</span>
                </div>
              </label>

              <label className={`relative flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-colors ${
                scheduleMode === 'cron'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}>
                <input
                  type="radio"
                  value="cron"
                  checked={scheduleMode === 'cron'}
                  onChange={(e) => setScheduleMode('cron')}
                  className="sr-only"
                />
                <div className="flex flex-col items-center space-y-1">
                  <ClockIcon className="h-5 w-5" />
                  <span className="text-xs font-medium">Cron Expression</span>
                </div>
              </label>
            </div>
          </div>

          {/* Frequency Configuration */}
          {scheduleMode === 'frequency' && (
            <div>
              <label htmlFor="frequency" className="block text-sm font-medium text-gray-700 mb-1">
                Crawl Frequency
              </label>
              <select
                id="frequency"
                value={localFrequency}
                onChange={(e) => setLocalFrequency(Number(e.target.value))}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                How often should this repository be crawled automatically?
              </p>
            </div>
          )}

          {/* Cron Configuration */}
          {scheduleMode === 'cron' && (
            <div>
              <label htmlFor="cronSchedule" className="block text-sm font-medium text-gray-700 mb-1">
                Cron Expression
              </label>
              <input
                type="text"
                id="cronSchedule"
                value={localCronSchedule}
                onChange={(e) => handleCronChange(e.target.value)}
                className={`block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                  cronError ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="0 0 2 * * * (daily at 2:00 AM)"
              />
              {cronError && (
                <div className="mt-1 flex items-center space-x-1 text-sm text-red-600">
                  <ExclamationTriangleIcon className="h-4 w-4" />
                  <span>{cronError}</span>
                </div>
              )}
              {!cronError && localCronSchedule && (
                <div className="mt-1 flex items-center space-x-1 text-sm text-green-600">
                  <CheckCircleIcon className="h-4 w-4" />
                  <span>Valid cron expression</span>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Format: seconds minutes hours day month weekday
              </p>

              {/* Common Examples */}
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-700 mb-2">Common Examples:</p>
                <div className="grid grid-cols-1 gap-1">
                  {getCommonCronExamples().map((example, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => handleCronChange(example.expression)}
                      className="text-left px-2 py-1 text-xs bg-gray-50 hover:bg-gray-100 rounded border-l-2 border-blue-500"
                    >
                      <code className="font-mono text-blue-600">{example.expression}</code>
                      <span className="ml-2 text-gray-600">- {example.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Max Duration */}
          <div>
            <label htmlFor="maxDuration" className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Crawl Duration
            </label>
            <select
              id="maxDuration"
              value={localDuration}
              onChange={(e) => setLocalDuration(Number(e.target.value))}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            >
              {DURATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Crawl will be terminated if it exceeds this duration
            </p>
          </div>

          {/* Next Run Info */}
          {getNextRunDescription() && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <ClockIcon className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-blue-800">{getNextRunDescription()}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};