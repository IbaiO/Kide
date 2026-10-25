import sys
import json
import pulp


def optimizazioa(balantz):
    users = list(balantz.keys())
    n = len(users)
    b = {u: float(balantz[u]) for u in users}

    # M = 100 * b_i
    M = 100.0 * max((abs(v) for v in b.values()), default=0.0)
    if M <= 0:
        M = 1000.0

    prob = pulp.LpProblem("Optimizazioa", pulp.LpMinimize)

    # Matrizeak
    x_vars = [[pulp.LpVariable(f"x_{i}_{j}", lowBound=0, cat='Continuous') for j in range(n)] for i in range(n)]
    t_vars = [[pulp.LpVariable(f"t_{i}_{j}", cat='Binary') for j in range(n)] for i in range(n)]

    # Optimizazio-funtzioa sortu
    # min Z = Σ_ij t_ij
    prob += pulp.lpSum(t_vars[i][j] for i in range(n) for j in range(n)), 'MinTransfers'
    for i in range(n):
        # Σ_j x_ji - Σ_j x_ij == b_i
        prob += (pulp.lpSum(x_vars[j][i] for j in range(n)) - pulp.lpSum(x_vars[i][j] for j in range(n)) == b[users[i]]), f"balance_{users[i]}"

        # x_ij <= M * t_ij
        for j in range(n):
            prob += x_vars[i][j] <= M * t_vars[i][j], f"bigM_{i}_{j}"

        # b_i * Σ_j t_ij <= 0
        if b[users[i]] > 0:
            prob += pulp.lpSum(t_vars[i][j] for j in range(n)) == 0, f"no_out_{users[i]}"

    # Ebatzi
    solver = pulp.PULP_CBC_CMD(msg=False)
    prob.solve(solver)

    # Matrize finalak
    x_matrix = [[pulp.value(x_vars[i][j]) or 0.0 for j in range(n)] for i in range(n)]
    t_matrix = [[int(round(pulp.value(t_vars[i][j]) or 0)) for j in range(n)] for i in range(n)]

    return {'x_matrix': x_matrix,
            't_matrix': t_matrix, # Oraingoz t_matrix ez da erabiltzen, baina baliteke aurrerago behar izatea.
            'users': users}


def balantzea(opZer):
    balantz = {}
    for oper in opZer:
        nork, nori, zenb = oper[0], oper[1], oper[2]

        if nork not in balantz:
            balantz[nork] = 0
        if nori not in balantz:
            balantz[nori] = 0

        balantz[nork] += zenb
        balantz[nori] -= zenb

    return balantz


def matrix_to_transfers(result):
    """
    x_matrix -> Transferentzia-zerrenda
    Formatua:
        [{ "from": userId, "to": userId, "amount": float }, ...]
    """
    users = result['users']
    x_matrix = result['x_matrix']
    transfers = []
    for i, from_user in enumerate(users):
        for j, to_user in enumerate(users):
            amount = round(x_matrix[i][j], 2)
            if amount > 0.01:
                transfers.append({
                    'from': from_user,
                    'to': to_user,
                    'amount': amount,
                })
    return transfers
 
 
if __name__ == '__main__':
    try:
        raw = sys.stdin.read()
        balance_array = json.loads(raw)
 
        # array({ userId, net }) -> dict
        balantz = {entry['userId']: entry['net'] for entry in balance_array}
 
        result = optimizazioa(balantz)
        transfers = matrix_to_transfers(result)
 
        print(json.dumps(transfers))
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)


"""
if __name__ == '__main__':
    print("=" * 80)
    print("PROBA KASUA 1: Kasu konplexua")
    print("=" * 80)
    opZer1 = [
        ("Leonhard Keler", "Txarly Argidago", 100),
        ("Leonhard Keler", "Joxelu Korta", 50),
        ("Leonhard Keler", "Garikoitz", 200),
        ("Txarly Argidago", "Joxelu Korta", 10),
        ("Joxelu Korta", "Garikoitz", 5),
        ("Joxelu Korta", "Txarly Argidago", 15),
        ("Txarly Argidago", "Garikoitz", 10),
        ("Garikoitz", "Txarly Argidago", 5),
        ("Garikoitz", "Leonhard Keler", 202),
        ("Joxelu Korta", "Leonhard Keler", 33),
        ("Txarly Argidago", "Leonhard Keler", 105),
    ]
    balantz1 = balantzea(opZer1)
    print('Balantzea:', balantz1)
    sol1 = optimizazioa(balantz1)
    print_x_matrix(sol1)
    print()

    print("=" * 80)
    print("PROBA KASUA 2: Kasu sinplea - 3 pertsona")
    print("=" * 80)
    opZer2 = [
        ("Leonhard Keler", "Txarly Argidago", 30),
        ("Leonhard Keler", "Joxelu Korta", 30),
    ]
    balantz2 = balantzea(opZer2)
    print('Balantzea:', balantz2)
    sol2 = optimizazioa(balantz2)
    print_x_matrix(sol2)
    print()

    print("=" * 80)
    print("PROBA KASUA 3: Balantzea 0 (transakzio orekatuak)")
    print("=" * 80)
    opZer3 = [
        ("Leonhard Keler", "Txarly Argidago", 50),
        ("Txarly Argidago", "Leonhard Keler", 50),
    ]
    balantz3 = balantzea(opZer3)
    print('Balantzea:', balantz3)
    sol3 = optimizazioa(balantz3)
    print_x_matrix(sol3)
    print()

    print("=" * 80)
    print("PROBA KASUA 4: Kasu sinplea - 2 pertsona bakarrik")
    print("=" * 80)
    opZer4 = [
        ("Garikoitz", "Joxelu Korta", 100),
    ]
    balantz4 = balantzea(opZer4)
    print('Balantzea:', balantz4)
    sol4 = optimizazioa(balantz4)
    print_x_matrix(sol4)
    print()

    print("=" * 80)
    print("PROBA KASUA 5: Zirkuitu kasu bat")
    print("=" * 80)
    opZer5 = [
        ("Leonhard Keler", "Txarly Argidago", 100),
        ("Txarly Argidago", "Garikoitz", 100),
        ("Garikoitz", "Leonhard Keler", 100),
    ]
    balantz5 = balantzea(opZer5)
    print('Balantzea:', balantz5)
    sol5 = optimizazioa(balantz5)
    print_x_matrix(sol5)
    print()

    print("=" * 80)
    print("PROBA KASUA 6: Pertsona batek guztiei zor die")
    print("=" * 80)
    opZer6 = [
        ("Leonhard Keler", "Txarly Argidago", 50),
        ("Leonhard Keler", "Joxelu Korta", 30),
        ("Leonhard Keler", "Garikoitz", 20),
    ]
    balantz6 = balantzea(opZer6)
    print('Balantzea:', balantz6)
    sol6 = optimizazioa(balantz6)
    print_x_matrix(sol6)
    print()

    print("=" * 80)
    print("PROBA KASUA 7: Guztiek pertsona bati zor diote")
    print("=" * 80)
    opZer7 = [
        ("Txarly Argidago", "Leonhard Keler", 40),
        ("Joxelu Korta", "Leonhard Keler", 60),
        ("Garikoitz", "Leonhard Keler", 25),
    ]
    balantz7 = balantzea(opZer7)
    print('Balantzea:', balantz7)
    sol7 = optimizazioa(balantz7)
    print_x_matrix(sol7)
    print()

    print("=" * 80)
    print("PROBA KASUA 8: Kopuru desberdinak")
    print("=" * 80)
    opZer8 = [
        ("Leonhard Keler", "Txarly Argidago", 15.50),
        ("Joxelu Korta", "Garikoitz", 23.75),
        ("Garikoitz", "Leonhard Keler", 10.25),
        ("Txarly Argidago", "Joxelu Korta", 5.00),
    ]
    balantz8 = balantzea(opZer8)
    print('Balantzea:', balantz8)
    sol8 = optimizazioa(balantz8)
    print_x_matrix(sol8)
"""