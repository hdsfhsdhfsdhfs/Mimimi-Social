-- Concede o selo verificado e o cargo Team Bunny à conta da equipe.
-- A identificação é feita pelo e-mail da conta autenticada, sem alterar outras contas.
update public.profiles as p
set
  is_official = true,
  role_label = 'Team Bunny',
  role_description = 'Membro oficial da equipe',
  updated_at = now()
from auth.users as u
where p.auth_user_id = u.id
  and lower(u.email) = lower('ryanponce115@gmail.com');

-- Confirmação: deve retornar exatamente o perfil atualizado.
select p.display_name, p.username, p.is_official, p.role_label, p.role_description
from public.profiles as p
join auth.users as u on u.id = p.auth_user_id
where lower(u.email) = lower('ryanponce115@gmail.com');
