{{/*
Common template helpers for ai-platform chart
*/}}
{{- define "ai-platform.name" -}}
{{- default .Chart.Name .Values.nameOverride }}
{{- end -}}

{{- define "ai-platform.fullname" -}}
{{- $name := include "ai-platform.name" . -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride }}
{{- else }}
{{- printf "%s-%s" $name .Release.Name | trunc 63 | trimSuffix "-" }}
{{- end -}}
{{- end -}}

{{- define "ai-platform.labels" -}}
app.kubernetes.io/name: {{ include "ai-platform.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
chart: {{ .Chart.Name }}-{{ .Chart.Version }}
heritage: {{ .Release.Service }}
{{- end -}}
