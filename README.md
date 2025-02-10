# KI-Assistent für Themenbaum-Konfiguration

## Übersicht
Boerdie ist ein interaktiver KI-Assistent, der Benutzer durch den Prozess der Konfiguration eines strukturierten Themenbaums für Bildungsinhalte führt. Der Assistent ist als Angular-Komponente implementiert und nutzt die OpenAI API für die Verarbeitung natürlicher Sprache.

## Features
- 🎯 **Schrittweise Konfiguration** eines Themenbaums mit 3 Hierarchieebenen
- 🤖 **KI-gestützte Konversation** mit natürlichsprachlicher Interaktion
- 🎨 **Modernes UI-Design** mit Angular Material
- 📝 **Markdown-Unterstützung** für formatierte Chat-Nachrichten
- 🔄 **Echtzeit-Formular-Updates** nach Benutzereingaben
- 🎓 **Bildungsstufen-Integration** mit standardisierten URIs
- 📚 **Fachgebiete-Mapping** zu offiziellen Taxonomien
- 👥 **Zielgruppen-Verwaltung** mit definierten Rollen
- ✨ **Automatische Themenbaumgenerierung** über REST-API

## Installation

```bash
# Repository klonen
git clone [repository-url]
cd topictreeconfigurationchatbot

# Abhängigkeiten installieren
npm install
```

## Konfiguration

### 1. Umgebungsvariablen
Erstellen Sie eine `environment.ts` und `environment.prod.ts` im Verzeichnis `src/environments/`:

```typescript
export const environment = {
  production: false, // true für environment.prod.ts
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini'
  }
};
```

### 2. OpenAI API-Schlüssel
1. Besuchen Sie [OpenAI API](https://platform.openai.com/)
2. Erstellen Sie einen API-Schlüssel
3. Fügen Sie den Schlüssel in Ihre Umgebungsvariablen ein

### 3. Unterstützte OpenAI Modelle
- Empfohlen: `gpt-4o-mini`

## Entwicklung

### Lokaler Entwicklungsserver
```bash
ng serve
```
Navigieren Sie zu `http://localhost:4200/`

### Tests
```bash
# Unit Tests
ng test

# End-to-End Tests
ng e2e
```

## REST-API Integration

Der Assistent generiert nach Abschluss der Konfiguration einen API-Aufruf zur Themenbaumgenerierung:

### Request

```http
POST /api/v1/topic-trees/generate
Content-Type: application/json

{
  "topic": "string",
  "mainCategories": number,
  "subCategories": number,
  "furtherSubCategories": number,
  "educationalContexts": string[],
  "disciplines": string[],
  "targetGroups": string[]
}
```

### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "id": "uuid",
  "status": "success",
  "data": {
    "topic": "string",
    "mainCategories": number,
    "subCategories": number,
    "furtherSubCategories": number,
    "educationalContexts": string[],
    "disciplines": string[],
    "targetGroups": string[],
    "createdAt": "ISO-8601-date",
    "uri": "/topic-trees/generated/uuid"
  }
}
```

## Mappings

### Bildungsstufen
Die Bildungsstufen werden automatisch auf standardisierte URIs gemappt:
```typescript
{
  "Grundschule": "http://w3id.org/openeduhub/vocabs/educationalContext/grundschule",
  "Sekundarstufe 1": "http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1",
  // ...
}
```

### Fachgebiete
Fachgebiete werden auf offizielle Taxonomien gemappt:
```typescript
{
  "Mathematik": "http://w3id.org/openeduhub/vocabs/discipline/mathematik",
  "Deutsch": "http://w3id.org/openeduhub/vocabs/discipline/deutsch",
  // ...
}
```

### Zielgruppen
Zielgruppen werden auf definierte Rollen gemappt:
```typescript
{
  "Lehrkraft": "http://w3id.org/openeduhub/vocabs/targetGroup/lehrkraft",
  "Schüler:in": "http://w3id.org/openeduhub/vocabs/targetGroup/schueler",
  // ...
}
```

## Lizenz
MIT
