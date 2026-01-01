{{- define "evaluator.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 -}}
{{- end -}}

{{- define "evaluator.fullname" -}}
{{- printf "%s" (include "evaluator.name" .) -}}
{{- end -}}
