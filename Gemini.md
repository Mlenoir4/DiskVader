# Contexte du Projet : DiskVader

## Mission
DiskVader est un utilitaire de bureau conçu pour aider les utilisateurs à visualiser et à gérer l'espace de stockage sur leur disque dur. L'objectif est de fournir un outil simple et intuitif pour identifier rapidement les fichiers et dossiers volumineux qui consomment le plus d'espace.

## Fonctionnalités Clés
- **Sélection de dossier** : L'utilisateur peut choisir n'importe quel dossier à analyser via une boîte de dialogue native.
- **Analyse récursive** : Le backend en Rust parcourt récursivement le dossier sélectionné pour en analyser le contenu.
- **Calcul de la taille** : L'application calcule la taille totale de chaque dossier en additionnant la taille de ses sous-éléments.
- **Visualisation arborescente** : Les résultats sont présentés dans une interface hiérarchique (arbre de fichiers).
- **Tri par pertinence** : Les fichiers et dossiers sont triés par taille décroissante, mettant en évidence les plus gourmands en espace.

## Stack Technique
- **Framework** : Tauri (permet de créer des applications de bureau avec des technologies web).
- **Backend** : Rust (pour la performance, la sécurité et les opérations système).
- **Frontend** : React avec Vite (pour une interface utilisateur réactive et moderne).

---

# Project DiskVader - Tâches à effectuer

Voici la liste des tâches extraites du fichier Kanban.

## Implémenter la sélection de dossier via l’interface (Tauri dialog)
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux pouvoir choisir un dossier à analyser.
- **Tâches**:
  - Utiliser Tauri API pour ouvrir un dialog système
  - Transmettre le chemin sélectionné à Rust via invoke
- **Étiquettes**: Frontend, UX
- **Priorité**: Haute

## Déclencher un scan récursif d’un dossier depuis Rust
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux que l’application scanne le contenu du dossier sélectionné.
- **Tâches**:
  - Implémenter une fonction récursive pour parcourir les fichiers et dossiers
  - Récupérer taille et métadonnées
- **Étiquettes**: Backend, Asynchrone
- **Priorité**: Haute

## Rendre le scan asynchrone pour ne pas bloquer l’UI
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux que le scan soit fluide et non bloquant.
- **Tâches**:
  - Utiliser tokio ou async-std pour le traitement
  - Gérer les threads si nécessaire
  - Retourner les résultats via callback ou channel
- **Étiquettes**: Backend, Asynchrone
- **Priorité**: Haute

## Calculer récursivement la taille de chaque dossier et fichier
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux connaître la taille totale des dossiers.
- **Tâches**:
  - Lire les tailles de fichiers
  - Additionner récursivement les tailles des sous-dossiers
- **Étiquettes**: Backend
- **Priorité**: Haute

## Indexer les fichiers et dossiers avec leur taille respective
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux que tous les fichiers soient listés avec leur taille.
- **Tâches**:
  - Structurer les données (nom, chemin, taille)
  - Créer une structure JSON pour le front
- **Étiquettes**: Backend
- **Priorité**: Haute

## Trier les dossiers et fichiers par taille décroissante
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux voir les éléments les plus gros en premier.
- **Tâches**:
  - Implémenter un tri descendant par taille dans la structure
  - Adapter l’export JSON
- **Étiquettes**: Backend, Logique métier
- **Priorité**: Haute

## Transmettre les résultats du scan de Rust vers le front React
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux voir les résultats du scan affichés dans l’interface.
- **Tâches**:
  - Utiliser `invoke` pour transmettre les données au front
  - Créer une fonction côté React pour réceptionner et stocker
- **Étiquettes**: Backend, Frontend
- **Priorité**: Moyenne

## Créer une interface arborescente pour explorer les dossiers
- **État**: Backlog
- **User Story**: En tant qu’utilisateur, je veux explorer les sous-dossiers facilement.
- **Tâches**:
  - Utiliser un composant collapsible/arbre dans React
  - Afficher les niveaux hiérarchiques
- **Étiquettes**: Frontend, UX
- **Priorité**: Moyenne

---

# Backend - Fonctions et Détails

Cette section récapitule les fonctions backend (commandes Tauri) nécessaires, avec des détails pour leur implémentation.

## 1. `select_folder`
- **Description**: Ouvre une boîte de dialogue système pour permettre à l'utilisateur de sélectionner un dossier. Retourne le chemin du dossier sélectionné.
- **Input Parameters**: Aucun.
- **Output**: `Option<String>` (chemin du dossier si sélectionné, `None` sinon).
- **Associated Frontend Pages**: `dashboard.tsx` (bouton "Choose Folder").
- **Kanban Tasks**: Implémenter la sélection de dossier via l’interface (Tauri dialog).

## 2. `start_scan`
- **Description**: Déclenche un scan récursif du dossier spécifié. Envoie des événements de progression (`scan_progress`) au frontend pendant le scan.
- **Input Parameters**: `path: String` (chemin du dossier à scanner).
- **Output**: `Result<(), String>` (succès ou erreur).
- **Associated Frontend Pages**: `dashboard.tsx` (bouton "Scan Entire Disk" et "Choose Folder"), `scan-results.tsx` (bouton "Rescan").
- **Kanban Tasks**: Déclencher un scan récursif d’un dossier depuis Rust, Rendre le scan asynchrone pour ne pas bloquer l’UI.

## 3. `get_scan_results`
- **Description**: Retourne les données récapitulatives du dernier scan effectué.
- **Input Parameters**: Aucun.
- **Output**: `ScanData` (structure contenant `total_files`, `total_folders`, `total_size`, `scan_time`, `scan_path`).
- **Associated Frontend Pages**: `scan-results.tsx`, `deep-analysis.tsx`, `visual-reports.tsx`.
- **Kanban Tasks**: Transmettre les résultats du scan de Rust vers le front React.

## 4. `get_largest_files`
- **Description**: Retourne une liste des fichiers les plus volumineux trouvés lors du dernier scan.
- **Input Parameters**: Aucun (pour l'instant, pourrait inclure un `limit` à l'avenir).
- **Output**: `Vec<FileItem>` (liste de structures `FileItem` contenant `id`, `name`, `path`, `size`, `file_type`, `extension`).
- **Associated Frontend Pages**: `scan-results.tsx`, `deep-analysis.tsx`, `visual-reports.tsx`.
- **Kanban Tasks**: Indexer les fichiers et dossiers avec leur taille respective, Trier les dossiers et fichiers par taille décroissante.

## 5. `get_folders`
- **Description**: Retourne une liste des dossiers avec leurs tailles agrégées et le nombre de fichiers.
- **Input Parameters**: Aucun (pour l'instant, pourrait inclure des filtres ou un `limit` à l'avenir).
- **Output**: `Vec<FolderItem>` (liste de structures `FolderItem` contenant `id`, `name`, `size`, `file_count`, `percentage`).
- **Associated Frontend Pages**: `scan-results.tsx`, `deep-analysis.tsx`, `visual-reports.tsx`.
- **Kanban Tasks**: Calculer récursivement la taille de chaque dossier et fichier, Indexer les fichiers et dossiers avec leur taille respective, Trier les dossiers et fichiers par taille décroissante.

## 6. `get_file_type_distribution`
- **Description**: Retourne la répartition de l'espace disque par type de fichier.
- **Input Parameters**: Aucun.
- **Output**: `Vec<FileTypeDistributionItem>` (liste de structures `FileTypeDistributionItem` contenant `file_type`, `size`, `count`, `color`).
- **Associated Frontend Pages**: `scan-results.tsx`, `visual-reports.tsx`.
- **Kanban Tasks**: Indexer les fichiers et dossiers avec leur taille respective.

## 7. `get_pie_chart_data`
- **Description**: Retourne les données formatées pour le graphique en secteurs (pie chart) de la page d'analyse approfondie.
- **Input Parameters**: Aucun.
- **Output**: `Vec<PieChartDataItem>` (liste de structures `PieChartDataItem` contenant `name`, `value`, `color`).
- **Associated Frontend Pages**: `deep-analysis.tsx`.
- **Kanban Tasks**: Transmettre les résultats du scan de Rust vers le front React.

## 8. `get_growth_data`
- **Description**: Retourne les données pour le graphique de tendance de croissance de l'espace disque.
- **Input Parameters**: Aucun.
- **Output**: `Vec<GrowthDataItem>` (liste de structures `GrowthDataItem` contenant `name`, `value`).
- **Associated Frontend Pages**: `deep-analysis.tsx`, `visual-reports.tsx`.
- **Kanban Tasks**: Transmettre les résultats du scan de Rust vers le front React.

## 9. `get_doughnut_data`
- **Description**: Retourne les données formatées pour le graphique en anneau (doughnut chart) de la page de rapports visuels.
- **Input Parameters**: Aucun.
- **Output**: `Vec<DoughnutDataItem>` (liste de structures `DoughnutDataItem` contenant `name`, `value`, `color`).
- **Associated Frontend Pages**: `visual-reports.tsx`.
- **Kanban Tasks**: Transmettre les résultats du scan de Rust vers le front React.

## 10. `get_trend_data`
- **Description**: Retourne les données pour le graphique de tendance d'utilisation de l'espace disque.
- **Input Parameters**: Aucun.
- **Output**: `Vec<TrendDataItem>` (liste de structures `TrendDataItem` contenant `name`, `value`).
- **Associated Frontend Pages**: `visual-reports.tsx`.
- **Kanban Tasks**: Transmettre les résultats du scan de Rust vers le front React.

## 11. `get_cleanup_suggestions`
- **Description**: Retourne une liste de suggestions de nettoyage basées sur l'analyse du disque.
- **Input Parameters**: Aucun.
- **Output**: `Vec<CleanupSuggestionItem>` (liste de structures `CleanupSuggestionItem` contenant `cleanup_type`, `size`, `count`, `color_class`).
- **Associated Frontend Pages**: `deep-analysis.tsx`, `space-cleanup.tsx`.
- **Kanban Tasks**: Aucune tâche Kanban spécifique pour les suggestions de nettoyage, mais liée à l'optimisation de l'espace.