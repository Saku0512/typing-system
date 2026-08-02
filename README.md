# typing-system

秋季スポーツ大会で使用する独自タイピングシステムの開発コンペティション用リポジトリです。

参加者はこのリポジトリをForkし、自分のFork上でシステムを実装してください。競技の公平性とSportEaseとの互換性を保つため、`docs/`にあるコア仕様、JSON Schema、問題プリセットは共通仕様として扱います。

## 参加方法

1. GitHubの「Fork」から、このリポジトリを自分のアカウントへForkする。
2. ForkしたリポジトリをローカルへCloneする。
3. `main`ブランチを基に、アプリケーション本体と必要なドキュメントを実装する。
4. 提出期限までに、実装済みのForkリポジトリURLを提出する。

このリポジトリへ直接Pushする必要はありません。提出期限や審査日程、必須機能は[RFP](./docs/独自タイピングシステム開発コンペティション%20RFP.md)を確認してください。

## 主要資料

- [提案依頼書（RFP）](./docs/独自タイピングシステム開発コンペティション%20RFP.md)
- [提案依頼書（PDF）](./docs/独自タイピングシステム開発コンペティション%20RFP.pdf)
- [共通仕様の範囲](./docs/typing_system_core_scope.md)
- [運営・試合状況機能仕様](./docs/typing_system_operations_spec.md)
- [入力判定仕様](./docs/typing_system_input_spec.md)
- [スコア計算仕様](./docs/typing_system_scoring_spec.md)
- [問題・問題セット仕様](./docs/typing_system_problem_spec.md)
- [確定結果JSON仕様](./docs/typing_system_results_json_spec.md)
- [共通入力適合テスト](./docs/typing-input-tests-v1.json)
- [本戦・予備問題プリセット](./docs/typing-problem-presets-v1.json)

## SportEaseとの連携

独自タイピングシステムは単体で大会準備、競技進行、結果確定までを行います。3試合終了後、仕様に従った確定結果JSONを出力し、SportEaseへ取り込みます。

## License

[MIT License](./LICENSE)
