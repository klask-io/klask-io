{{/*
Expand the name of the chart.
*/}}
{{- define "klask.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "klask.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "klask.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels
*/}}
{{- define "klask.labels" -}}
helm.sh/chart: {{ include "klask.chart" . }}
{{ include "klask.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels
*/}}
{{- define "klask.selectorLabels" -}}
app.kubernetes.io/name: {{ include "klask.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Create the name of the service account to use
*/}}
{{- define "klask.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "klask.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
PostgreSQL service name
*/}}
{{- define "klask.postgresql.servicename" -}}
{{- if .Values.postgresql.enabled -}}
{{- printf "%s-postgresql" (include "klask.fullname" .) -}}
{{- else -}}
{{- .Values.postgresql.external.host -}}
{{- end -}}
{{- end -}}

{{/*
Database URL
*/}}
{{- define "klask.database.url" -}}
{{- if .Values.postgresql.enabled -}}
postgresql://{{ .Values.postgresql.auth.username }}:{{ .Values.postgresql.auth.password }}@{{ include "klask.postgresql.servicename" . }}:5432/{{ .Values.postgresql.auth.database }}
{{- else -}}
{{ .Values.postgresql.external.url }}
{{- end -}}
{{- end -}}